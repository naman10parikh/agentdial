import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  saveCredential,
  getCredential,
  listCredentials,
} from "../lib/credentials.js";
import { success, error, info, warn, heading, box } from "../lib/ui.js";
import { VOICE_PROVIDERS, type VoiceProvider } from "../adapters/voice.js";

// ── Helpers ──

async function ask(
  rl: ReturnType<typeof createInterface>,
  prompt: string,
  fallback?: string,
): Promise<string> {
  const suffix = fallback ? ` (${fallback})` : "";
  const answer = (await rl.question(`  ${prompt}${suffix} `)).trim();
  return answer || fallback || "";
}

// ── Voice Setup ──

export async function cmdVoiceSetup(): Promise<void> {
  heading("Voice Channel Setup");

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    // Step 1: Check for existing Twilio creds (reuse from SMS/WhatsApp)
    heading("1/3  Twilio Credentials");

    let sid = await getCredential("voice", "account_sid");
    let token = await getCredential("voice", "auth_token");
    let phone = await getCredential("voice", "phone_number");

    // Fall back to SMS credentials
    if (!sid) sid = await getCredential("sms", "accountSid");
    if (!token) token = await getCredential("sms", "authToken");
    if (!phone) phone = await getCredential("sms", "phoneNumber");

    if (sid && token && phone) {
      success(`Twilio credentials found (SID: ${sid.slice(0, 8)}...)`);
      success(`Phone: ${phone}`);
      info("Reusing existing Twilio credentials for voice.");
    } else {
      info("No existing Twilio credentials found.");
      info("Enter your Twilio credentials (twilio.com/console):");
      console.log("");

      sid = await ask(rl, "Account SID:");
      token = await ask(rl, "Auth Token:");
      phone = await ask(rl, "Phone Number (e.g. +1234567890):");

      if (!sid || !token || !phone) {
        error("All three Twilio credentials are required.");
        return;
      }
    }

    await saveCredential("voice", "account_sid", sid);
    await saveCredential("voice", "auth_token", token);
    await saveCredential("voice", "phone_number", phone);
    success("Twilio credentials saved for voice channel.");

    // Step 2: Select voice provider
    heading("2/3  Voice Provider");
    console.log("");
    console.log("  Select a speech-to-speech provider:");
    console.log("");

    for (let i = 0; i < VOICE_PROVIDERS.length; i++) {
      const p = VOICE_PROVIDERS[i]!;
      const num = String(i + 1).padStart(2);
      const cost = `(${p.cost})`.padEnd(22);
      console.log(`  ${num}) ${p.name.padEnd(22)} ${cost} ${p.description}`);
    }
    console.log("");

    const currentProvider = await getCredential("voice", "voice_provider");
    const defaultNum = currentProvider
      ? String(VOICE_PROVIDERS.findIndex((p) => p.id === currentProvider) + 1)
      : "1";

    const choice = await ask(rl, "Enter number:", defaultNum);
    const idx = parseInt(choice, 10) - 1;

    if (isNaN(idx) || idx < 0 || idx >= VOICE_PROVIDERS.length) {
      error("Invalid selection.");
      return;
    }

    const selected = VOICE_PROVIDERS[idx]!;
    await saveCredential("voice", "voice_provider", selected.id);
    success(`Voice provider: ${selected.name}`);

    // Step 3: Provider-specific credentials
    heading("3/3  Provider Credentials");

    if (selected.credentialKeys.length === 0) {
      info("No additional credentials needed for this provider.");
    } else {
      for (const key of selected.credentialKeys) {
        const existing = await getCredential("voice", key);
        const prompt = `${key}:`;
        const value = await ask(rl, prompt, existing ?? undefined);

        if (value) {
          await saveCredential("voice", key, value);
          success(`Saved ${key}`);
        } else {
          warn(`Skipped ${key} -- set later with \`agentdial voice setup\``);
        }
      }
    }

    // Summary
    console.log("");
    box(
      "Voice Setup Complete",
      [
        `Twilio: ${phone}`,
        `Provider: ${selected.name} (${selected.cost})`,
        "",
        "Webhook URL for Twilio console:",
        "  https://YOUR_DOMAIN/api/voice/webhook",
        "",
        "Next steps:",
        "  agentdial voice test    -- validate credentials",
        "  agentdial voice status  -- view configuration",
        "  agentdial serve         -- start the gateway",
      ].join("\n"),
    );
  } finally {
    rl.close();
  }
}

// ── Voice Test ──

export async function cmdVoiceTest(opts: { number?: string }): Promise<void> {
  heading("Voice Channel Test");

  const sid = await getCredential("voice", "account_sid");
  const token = await getCredential("voice", "auth_token");
  const phone = await getCredential("voice", "phone_number");
  const provider = await getCredential("voice", "voice_provider");

  if (!sid || !token || !phone) {
    error("Voice not configured. Run `agentdial voice setup` first.");
    return;
  }

  // Validate Twilio credentials
  info("Checking Twilio credentials...");
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}.json`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      },
    });
    if (!res.ok) {
      error(`Twilio auth failed: HTTP ${res.status}`);
      return;
    }
    success("Twilio credentials valid");
  } catch (err) {
    error(
      `Twilio connection failed: ${err instanceof Error ? err.message : "Unknown"}`,
    );
    return;
  }

  // Validate voice provider credentials
  const providerMeta = VOICE_PROVIDERS.find((p) => p.id === provider);
  if (providerMeta) {
    info(`Checking ${providerMeta.name} credentials...`);
    let allPresent = true;
    for (const key of providerMeta.credentialKeys) {
      const val = await getCredential("voice", key);
      if (val) {
        success(`${key}: present`);
      } else {
        warn(`${key}: missing`);
        allPresent = false;
      }
    }
    if (!allPresent) {
      warn("Some provider credentials missing. Run `agentdial voice setup`.");
    }
  }

  success("Voice pipeline validation complete.");
  info(`Phone: ${phone}`);
  info(`Provider: ${providerMeta?.name ?? provider ?? "not set"}`);

  if (opts.number) {
    info(`To make a test call to ${opts.number}, start the gateway first:`);
    info("  agentdial serve");
  }
}

// ── Voice Status ──

export async function cmdVoiceStatus(): Promise<void> {
  heading("Voice Channel Status");

  const sid = await getCredential("voice", "account_sid");
  const phone = await getCredential("voice", "phone_number");
  const provider = await getCredential("voice", "voice_provider");
  const keys = await listCredentials("voice");

  if (!sid) {
    warn("Voice not configured. Run `agentdial voice setup`.");
    return;
  }

  success(`Twilio SID: ${sid.slice(0, 8)}...`);
  success(`Phone: ${phone ?? "not set"}`);

  const providerMeta = VOICE_PROVIDERS.find((p) => p.id === provider);
  if (providerMeta) {
    success(`Provider: ${providerMeta.name} (${providerMeta.cost})`);
  } else {
    warn("Provider: not configured");
  }

  info(`Stored credential keys: ${keys.join(", ")}`);
}
