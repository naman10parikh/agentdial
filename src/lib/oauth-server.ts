/**
 * Temporary local HTTP server for OAuth callbacks.
 * Like `gh auth login` — opens browser, waits for callback, returns code.
 */

import { createServer, type Server } from "node:http";
import { exec } from "node:child_process";
import { platform } from "node:os";
import { URL } from "node:url";

export interface OAuthResult {
  code: string;
  state?: string;
}

const DEFAULT_PORT = 7891;
const DEFAULT_TIMEOUT = 120_000; // 2 minutes

const DEFAULT_SUCCESS_HTML = `
<!DOCTYPE html>
<html>
<head><title>Authorization Complete</title></head>
<body style="background:#141312;color:#E5E7EB;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
  <div style="text-align:center">
    <h1 style="color:#8B5CF6">Authorization Successful</h1>
    <p>You can close this tab and return to your terminal.</p>
  </div>
</body>
</html>
`;

function openBrowser(url: string): void {
  const cmd = platform() === "darwin" ? "open" : "xdg-open";
  exec(`${cmd} "${url}"`, () => {
    /* intentionally silent — browser open is best-effort */
  });
}

export async function startOAuthFlow(options: {
  authorizeUrl: string;
  port?: number;
  timeout?: number;
  successHtml?: string;
}): Promise<OAuthResult> {
  const port = options.port ?? DEFAULT_PORT;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const successHtml = options.successHtml ?? DEFAULT_SUCCESS_HTML;

  return new Promise<OAuthResult>((resolve, reject) => {
    let server: Server | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = (): void => {
      if (timer) clearTimeout(timer);
      if (server) {
        server.close();
        server = null;
      }
    };

    server = createServer((req, res) => {
      if (!req.url) {
        res.writeHead(404);
        res.end();
        return;
      }

      const parsed = new URL(req.url, `http://localhost:${port}`);
      if (!parsed.pathname.endsWith("/callback")) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const code = parsed.searchParams.get("code");
      const state = parsed.searchParams.get("state") ?? undefined;
      const error = parsed.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h1>Authorization failed: ${error}</h1>`);
        cleanup();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h1>Missing authorization code</h1>");
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(successHtml);
      cleanup();
      resolve({ code, state });
    });

    server.listen(port, () => {
      openBrowser(options.authorizeUrl);
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
      cleanup();
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${port} is already in use. Close the other process or use a different port.`,
          ),
        );
      } else {
        reject(err);
      }
    });

    timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `OAuth flow timed out after ${timeout / 1000}s. No callback received.`,
        ),
      );
    }, timeout);
  });
}
