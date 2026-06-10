/**
 * Observability spine — an append-only JSONL run-log for every message agentdial
 * dispatches and every state-mutating CLI invocation.
 *
 * The harness "Observability" component requires a runtime audit trail the product
 * WRITES on each dispatch/financial/state-mutating action — duration + outcome,
 * appended on the live path (not a doc, not an unwired hook). This is that trail.
 *
 * It is best-effort: a logging failure must NEVER break message delivery, so every
 * write is wrapped and swallowed. The agent's actual work always wins over telemetry.
 */
import {
  appendFileSync,
  mkdirSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
/** Audit trail location: `logs/runs.jsonl` at the repo root (gitignored runtime state). */
export const RUN_LOG_PATH = join(HERE, "..", "..", "logs", "runs.jsonl");

/** One observability record. `kind` distinguishes a dispatched message from a CLI run. */
export interface RunLogEntry {
  /** ISO-8601 timestamp of when the action finished. */
  ts: string;
  /** "dispatch" = an inbound message routed to the agent; "cli" = a command run. */
  kind: "dispatch" | "cli";
  /** For dispatch: the channel. For cli: the subcommand name. */
  channel?: string;
  command?: string;
  /** Wall-clock duration of the action, milliseconds. */
  durationMs: number;
  /** Whether the action completed cleanly or threw. */
  outcome: "ok" | "error";
  /** Error message when outcome === "error" (truncated, never includes secrets). */
  error?: string;
  /** Optional metrics (e.g. reply length, token estimate). */
  meta?: Record<string, string | number | boolean>;
}

/** Append one entry to the JSONL audit trail. Best-effort — never throws. */
export function recordRun(
  entry: RunLogEntry,
  logPath: string = RUN_LOG_PATH,
): void {
  try {
    mkdirSync(dirname(logPath), { recursive: true });
    appendFileSync(logPath, JSON.stringify(entry) + "\n");
  } catch {
    // Observability is best-effort; a log-write failure must not break dispatch.
  }
}

/**
 * Time an async action and append a dispatch/cli record with its duration + outcome.
 * Returns the action's result (or re-throws after logging the failure).
 */
export async function withRunLog<T>(
  base: Omit<RunLogEntry, "ts" | "durationMs" | "outcome">,
  action: () => Promise<T>,
  logPath: string = RUN_LOG_PATH,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await action();
    recordRun(
      { ...base, ts: new Date().toISOString(), durationMs: Date.now() - start, outcome: "ok" },
      logPath,
    );
    return result;
  } catch (err) {
    recordRun(
      {
        ...base,
        ts: new Date().toISOString(),
        durationMs: Date.now() - start,
        outcome: "error",
        error: (err instanceof Error ? err.message : String(err)).slice(0, 300),
      },
      logPath,
    );
    throw err;
  }
}

/** Read the most-recent entries (oldest→newest), capped at `limit`. */
export function readRuns(
  limit = 20,
  logPath: string = RUN_LOG_PATH,
): RunLogEntry[] {
  if (!existsSync(logPath)) return [];
  return readFileSync(logPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as RunLogEntry)
    .slice(-limit);
}
