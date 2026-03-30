import { spawn, execSync } from "node:child_process";
import { info } from "./ui.js";

interface TunnelResult {
  url: string;
  close: () => void;
}

const CLOUDFLARED_URL_REGEX = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
const LOCALTUNNEL_URL_REGEX = /https:\/\/[a-z0-9-]+\.loca\.lt/;

/**
 * Start a localhost tunnel. Tries cloudflared first (no signup needed),
 * then localtunnel as a fallback.
 */
export async function startTunnel(port: number): Promise<TunnelResult> {
  // Try cloudflared first
  try {
    return await tryCloudflared(port);
  } catch {
    info("cloudflared not found, trying localtunnel...");
  }

  // Fallback to localtunnel
  try {
    return await tryLocaltunnel(port);
  } catch {
    // Nothing worked
  }

  throw new Error(
    "No tunnel tool available. Install one of:\n" +
      "  brew install cloudflared   (recommended, fastest)\n" +
      "  npm install -g localtunnel\n" +
      "  or install ngrok from ngrok.com",
  );
}

function tryCloudflared(port: number): Promise<TunnelResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "cloudflared",
      ["tunnel", "--url", `http://localhost:${String(port)}`],
      {
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        reject(new Error("cloudflared timed out"));
      }
    }, 30_000);

    const handleOutput = (data: Buffer): void => {
      if (settled) return;
      const text = data.toString();
      const match = CLOUDFLARED_URL_REGEX.exec(text);
      if (match) {
        settled = true;
        clearTimeout(timeout);
        resolve({
          url: match[0],
          close: () => child.kill(),
        });
      }
    };

    child.stdout.on("data", handleOutput);
    child.stderr.on("data", handleOutput);

    child.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    child.on("exit", (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`cloudflared exited with code ${String(code)}`));
      }
    });
  });
}

function tryLocaltunnel(port: number): Promise<TunnelResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["localtunnel", "--port", String(port)], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        reject(new Error("localtunnel timed out"));
      }
    }, 30_000);

    child.stdout.on("data", (data: Buffer) => {
      if (settled) return;
      const text = data.toString();
      const match = LOCALTUNNEL_URL_REGEX.exec(text);
      if (match) {
        settled = true;
        clearTimeout(timeout);
        resolve({
          url: match[0],
          close: () => child.kill(),
        });
      }
    });

    child.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    child.on("exit", (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`localtunnel exited with code ${String(code)}`));
      }
    });
  });
}

/** Check if a tunnel tool is available on the system. */
export function hasTunnelTool(): boolean {
  try {
    execSync("which cloudflared", { stdio: "ignore" });
    return true;
  } catch {
    try {
      execSync("which npx", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }
}
