/**
 * sandbox — run untrusted, agent-supplied code in an isolated E2B Firecracker
 * microVM instead of on the host where agentdial holds the agent's identity and
 * channel credentials.
 *
 * Why this exists (the "Sandbox/Infra" harness component): agentdial is an
 * identity gateway — a single agent reachable across Telegram/Discord/Slack/
 * WhatsApp/SMS/voice/email. An inbound message can ask that agent to *execute*
 * something ("run this script", "what does this Python print?"). Running that on
 * the host is a direct path to credential exfiltration. The isolation boundary is
 * a per-request E2B sandbox: create → run → capture → kill. The host never
 * executes the untrusted command.
 *
 * Trust envelope mirrors `sandforge/templates/e2b-default` (strict default,
 * short-lived task) and the lifecycle mirrors
 * `energy/packages/runtime/src/sandbox/container-runner.ts`
 * (`Sandbox.create` → `commands.run` → `kill`).
 *
 * The E2B API key is read from `E2B_API_KEY` (this repo's `.env`); it is never
 * logged and never passed to the sandboxed program.
 */
import { Sandbox } from "@e2b/sdk";

/** Outcome of running one command inside an isolated sandbox. */
export interface SandboxRunResult {
  /** E2B sandbox id the command ran in (for audit / debugging). */
  sandboxId: string;
  /** Process exit code (0 = clean). */
  exitCode: number;
  /** Captured stdout. */
  stdout: string;
  /** Captured stderr. */
  stderr: string;
  /** Wall-clock duration of create→run→kill, milliseconds. */
  durationMs: number;
}

/** Options for {@link runInSandbox}. */
export interface SandboxRunOptions {
  /** E2B API key. Defaults to `process.env.E2B_API_KEY`. */
  apiKey?: string;
  /**
   * Hard wall-clock cap for the sandbox, milliseconds. Kept short because this
   * is a one-shot task runner, not a long-lived session. Default 60s.
   */
  timeoutMs?: number;
  /** E2B template id. Default is E2B's maintained base image. */
  template?: string;
}

/**
 * Boot a fresh E2B sandbox, run a single shell command inside it, capture the
 * result, and always tear the sandbox down (even on failure).
 *
 * This is the real isolation point: the `command` string is agent/user supplied
 * and is NEVER executed on the host — only inside the microVM.
 */
export async function runInSandbox(
  command: string,
  options: SandboxRunOptions = {},
): Promise<SandboxRunResult> {
  const apiKey = options.apiKey ?? process.env["E2B_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "E2B_API_KEY is not set. Add it to .env to run code in an isolated sandbox.",
    );
  }

  const timeoutMs = options.timeoutMs ?? 60_000;
  const start = Date.now();

  // Create the isolated microVM. `template` selects E2B's base image by default.
  const sandbox = options.template
    ? await Sandbox.create(options.template, { apiKey, timeoutMs })
    : await Sandbox.create({ apiKey, timeoutMs });

  try {
    // Run the untrusted command INSIDE the sandbox. `commands.run` returns
    // stdout/stderr/exitCode; we don't throw on non-zero so the caller can see
    // the real exit code and stderr.
    const res = await sandbox.commands.run(command, {
      timeoutMs,
      requestTimeoutMs: timeoutMs,
    });
    return {
      sandboxId: sandbox.sandboxId,
      exitCode: res.exitCode,
      stdout: res.stdout,
      stderr: res.stderr,
      durationMs: Date.now() - start,
    };
  } finally {
    // Always release the microVM — leaking sandboxes burns money and quota.
    await sandbox.kill().catch(() => {
      // Best-effort teardown; a kill failure must not mask the run result/error.
    });
  }
}
