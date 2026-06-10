import { runInSandbox } from "../lib/sandbox.js";
import { withRunLog } from "../lib/run-log.js";
import { heading, info, success, error, warn } from "../lib/ui.js";

/**
 * `agentdial sandbox-run "<command>"` — execute an agent/user-supplied command in
 * an isolated E2B Firecracker microVM, NOT on the host.
 *
 * This is agentdial's untrusted-code escape hatch: when an inbound message asks
 * the agent to run something, the host (which holds the agent's identity and
 * channel credentials) must never execute it. We boot a fresh sandbox, run the
 * command inside it, capture stdout/stderr/exitCode, log the run to the
 * observability spine (logs/runs.jsonl), and tear the sandbox down.
 */
export async function cmdSandboxRun(
  command: string,
  opts: { timeout?: string; template?: string; json?: boolean },
): Promise<void> {
  const timeoutMs = opts.timeout ? parseInt(opts.timeout, 10) * 1000 : undefined;

  if (!process.env["E2B_API_KEY"]) {
    error("E2B_API_KEY is not set.");
    info("Add it to .env to run untrusted code in an isolated sandbox.");
    info("Get a key at https://e2b.dev/dashboard");
    return;
  }

  if (!opts.json) {
    heading("Sandbox Run (E2B Firecracker microVM)");
    info(`command: ${command}`);
    info("booting isolated sandbox — host never executes this command...");
  }

  try {
    // The run is wrapped in the observability spine so every sandbox execution
    // is timed and appended to logs/runs.jsonl (duration + ok/error outcome).
    const result = await withRunLog(
      { kind: "cli", command: "sandbox-run" },
      () =>
        runInSandbox(command, {
          ...(timeoutMs !== undefined ? { timeoutMs } : {}),
          ...(opts.template ? { template: opts.template } : {}),
        }),
    );

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    success(`sandbox ${result.sandboxId} — exit ${String(result.exitCode)} in ${String(result.durationMs)}ms`);
    console.log("");
    if (result.stdout.trim()) {
      info("stdout:");
      console.log(result.stdout.replace(/\n$/, ""));
    }
    if (result.stderr.trim()) {
      warn("stderr:");
      console.log(result.stderr.replace(/\n$/, ""));
    }
    console.log("");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`Sandbox run failed: ${msg}`);
  }
}
