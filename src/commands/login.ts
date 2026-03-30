/**
 * AgentDial Login/Logout/Whoami CLI Commands
 *
 * `agentdial login`  — Opens browser for Clerk OAuth, stores JWT locally
 * `agentdial logout` — Clears stored credentials
 * `agentdial whoami` — Shows current auth state
 */

import chalk from "chalk";
import { heading, success, error, info, warn, box } from "../lib/ui.js";
import {
  login,
  loadAuthSession,
  clearAuthSession,
  isAuthenticated,
  autoProvision,
} from "../lib/auth.js";
import type { LoginOptions, AutoProvisionResult } from "../lib/auth.js";

const brand = chalk.hex("#8B5CF6");
const dim = chalk.hex("#6B7280");
const green = chalk.green;

// ── agentdial login ──

export interface LoginCommandOptions {
  /** Skip auto-provision after login */
  skipProvision?: boolean;
  /** Override Clerk frontend API URL */
  clerkUrl?: string;
}

export async function cmdLogin(options?: LoginCommandOptions): Promise<void> {
  heading("AgentDial Login");

  // Check if already authenticated
  const existing = await loadAuthSession();
  if (existing && existing.expiresAt > Date.now() + 60_000) {
    const name = existing.name ?? existing.email ?? existing.userId;
    warn(`Already logged in as ${brand(name)}`);
    info("Run `agentdial logout` first to switch accounts.");
    return;
  }

  info("Opening browser for authentication...");
  console.log(
    dim("  (If the browser doesn't open, check your terminal for the URL)"),
  );
  console.log("");

  try {
    const loginOpts: LoginOptions = {};
    if (options?.clerkUrl) {
      loginOpts.clerkConfig = { frontendApi: options.clerkUrl };
    }

    const session = await login(loginOpts);

    console.log("");
    success(
      `Logged in as ${brand(session.name ?? session.email ?? session.userId)}`,
    );

    if (session.email) {
      info(`Email: ${session.email}`);
    }
    info(`User ID: ${dim(session.userId)}`);
    info(
      `Session expires: ${dim(new Date(session.expiresAt).toLocaleString())}`,
    );

    // Auto-provision channels if not skipped
    if (!options?.skipProvision) {
      console.log("");
      await runAutoProvision(
        session.name ?? session.email ?? "user",
        session.name ?? "Agent",
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("timed out")) {
      error("Login timed out — no response from browser.");
      info("Try again with: agentdial login");
    } else if (msg.includes("EADDRINUSE")) {
      error(
        "Callback port is in use. Close other agentdial instances and try again.",
      );
    } else {
      error(`Login failed: ${msg}`);
    }
  }
}

// ── agentdial logout ──

export async function cmdLogout(): Promise<void> {
  heading("AgentDial Logout");

  const session = await loadAuthSession();
  if (!session) {
    info("Not currently logged in.");
    return;
  }

  const name = session.name ?? session.email ?? session.userId;
  await clearAuthSession();
  success(`Logged out ${brand(name)}`);
  info("Local credentials cleared. Managed sub-accounts are preserved.");
}

// ── agentdial whoami ──

export async function cmdWhoami(options?: { json?: boolean }): Promise<void> {
  const session = await loadAuthSession();

  if (!session) {
    if (options?.json) {
      console.log(JSON.stringify({ authenticated: false }));
      return;
    }
    heading("AgentDial — Not Logged In");
    info("Run `agentdial login` to authenticate.");
    return;
  }

  const authenticated = await isAuthenticated();
  const expired = !authenticated;

  if (options?.json) {
    console.log(
      JSON.stringify(
        {
          authenticated,
          userId: session.userId,
          email: session.email ?? null,
          name: session.name ?? null,
          expiresAt: session.expiresAt,
          expired,
          managedAccounts: session.managedAccounts ?? null,
        },
        null,
        2,
      ),
    );
    return;
  }

  heading("AgentDial — Current Session");

  const name = session.name ?? session.email ?? session.userId;
  const statusLabel = expired ? chalk.red("expired") : green("active");

  const lines = [
    `User:    ${brand(name)}`,
    `Email:   ${session.email ?? dim("not set")}`,
    `User ID: ${dim(session.userId)}`,
    `Status:  ${statusLabel}`,
    `Expires: ${dim(new Date(session.expiresAt).toLocaleString())}`,
  ];

  // Show managed accounts
  const managed = session.managedAccounts;
  if (managed) {
    lines.push("");
    lines.push(brand("Managed Accounts:"));
    if (managed.twilioSubAccountSid) {
      lines.push(`  Twilio:    ${dim(managed.twilioSubAccountSid)}`);
    }
    if (managed.agentMailInboxId) {
      lines.push(`  AgentMail: ${dim(managed.agentMailInboxId)}`);
    }
    if (managed.sendGridSubuserId) {
      lines.push(`  SendGrid:  ${dim(managed.sendGridSubuserId)}`);
    }
    if (
      !managed.twilioSubAccountSid &&
      !managed.agentMailInboxId &&
      !managed.sendGridSubuserId
    ) {
      lines.push(`  ${dim("None provisioned yet")}`);
    }
  }

  box("Session", lines.join("\n"));

  if (expired) {
    console.log("");
    warn("Session expired. Run `agentdial login` to re-authenticate.");
  }
}

// ── Auto-Provision Helper ──

async function runAutoProvision(
  userName: string,
  agentName: string,
): Promise<void> {
  info("Checking auto-provision eligibility...");

  // Check for environment variables or config for master credentials
  const twilioMasterSid = process.env["TWILIO_MASTER_SID"];
  const twilioMasterToken = process.env["TWILIO_MASTER_TOKEN"];
  const agentMailApiKey = process.env["AGENTMAIL_API_KEY"];

  const hasProvisionableResources =
    Boolean(twilioMasterSid) || Boolean(agentMailApiKey);

  if (!hasProvisionableResources) {
    info(
      "No auto-provision credentials found. Channels can be set up manually:",
    );
    info("  agentdial recipes          — view all setup recipes");
    info("  agentdial channels add     — add a channel manually");
    return;
  }

  try {
    const result = await autoProvision({
      userName,
      agentName,
      twilioMasterSid,
      twilioMasterToken,
      agentMailApiKey,
    });

    displayProvisionResults(result);
  } catch (err) {
    warn(
      `Auto-provision error: ${err instanceof Error ? err.message : String(err)}`,
    );
    info("You can set up channels manually with: agentdial recipes");
  }
}

function displayProvisionResults(result: AutoProvisionResult): void {
  heading("Auto-Provisioned Channels");

  // Email
  if (result.email) {
    if (result.email.ok) {
      success(
        `Email: ${result.email.address ?? "configured"} (${result.email.provider})`,
      );
    } else {
      warn(
        `Email: ${result.email.error ?? "failed"} (${result.email.provider})`,
      );
    }
  }

  // Phone
  if (result.phone) {
    if (result.phone.ok) {
      success(`Phone: ${result.phone.number ?? "configured"}`);
    } else {
      warn(`Phone: ${result.phone.error ?? "failed"}`);
    }
  }

  // Per-channel results
  const manualChannels = result.channels.filter((c) => !c.provisioned);
  if (manualChannels.length > 0) {
    console.log("");
    info("Manual setup needed for:");
    for (const ch of manualChannels) {
      console.log(dim(`  ${ch.channel}: ${ch.error ?? "not configured"}`));
    }
    console.log("");
    info("Run `agentdial recipes` for step-by-step setup guides.");
  }
}
