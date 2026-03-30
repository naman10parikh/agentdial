import type { ChannelAdapter, ChannelType } from "./types.js";
import { TelegramAdapter } from "./telegram.js";
import { DiscordAdapter } from "./discord.js";
import { SlackAdapter } from "./slack.js";
import { TwilioSmsAdapter } from "./twilio-sms.js";
import { TwilioWhatsAppAdapter } from "./twilio-whatsapp.js";
import { EmailAdapter } from "./email.js";
import { VoiceAdapter } from "./voice.js";
import { VapiVoiceAdapter } from "./voice-vapi.js";
import { AgentMailAdapter } from "./email-agentmail.js";

// ── Provider Variants ──
// Some channels have multiple provider options (e.g., voice: Twilio vs VAPI).
// The default adapter map uses the "classic" providers. Use getAlternateAdapter()
// to get a specific provider variant.

const adapters = new Map<ChannelType, ChannelAdapter>([
  ["telegram", new TelegramAdapter()],
  ["discord", new DiscordAdapter()],
  ["slack", new SlackAdapter()],
  ["sms", new TwilioSmsAdapter()],
  ["whatsapp", new TwilioWhatsAppAdapter()],
  ["email", new EmailAdapter()],
  ["voice", new VoiceAdapter()],
]);

/** Provider variants keyed as "channel:provider" (e.g., "voice:vapi"). */
const alternateAdapters = new Map<string, ChannelAdapter>([
  ["voice:vapi", new VapiVoiceAdapter()],
  ["email:agentmail", new AgentMailAdapter()],
]);

export function getAdapter(channel: ChannelType): ChannelAdapter {
  const adapter = adapters.get(channel);
  if (!adapter) throw new Error(`No adapter for channel: ${channel}`);
  return adapter;
}

/**
 * Get an alternate provider adapter for a channel.
 * @param channel The channel type (e.g., "voice", "email")
 * @param provider The provider name (e.g., "vapi", "agentmail")
 */
export function getAlternateAdapter(
  channel: ChannelType,
  provider: string,
): ChannelAdapter | undefined {
  return alternateAdapters.get(`${channel}:${provider}`);
}

/** List available providers for a channel. */
export function getProviders(channel: ChannelType): string[] {
  const providers: string[] = ["default"];
  for (const key of alternateAdapters.keys()) {
    if (key.startsWith(`${channel}:`)) {
      providers.push(key.split(":")[1]);
    }
  }
  return providers;
}

export function getAllAdapters(): ChannelAdapter[] {
  return [...adapters.values()];
}

export function getAllAdaptersIncludingAlternates(): ChannelAdapter[] {
  return [...adapters.values(), ...alternateAdapters.values()];
}

export function hasAdapter(channel: ChannelType): boolean {
  return adapters.has(channel);
}

export { TelegramAdapter } from "./telegram.js";
export { DiscordAdapter } from "./discord.js";
export { SlackAdapter } from "./slack.js";
export { TwilioSmsAdapter } from "./twilio-sms.js";
export { TwilioWhatsAppAdapter } from "./twilio-whatsapp.js";
export { EmailAdapter } from "./email.js";
export { VoiceAdapter } from "./voice.js";
export { VapiVoiceAdapter } from "./voice-vapi.js";
export { AgentMailAdapter } from "./email-agentmail.js";
