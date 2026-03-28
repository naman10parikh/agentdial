import { TelegramAdapter } from "./telegram.js";
import { DiscordAdapter } from "./discord.js";
import { SlackAdapter } from "./slack.js";
import { TwilioSmsAdapter } from "./twilio-sms.js";
import { TwilioWhatsAppAdapter } from "./twilio-whatsapp.js";
import { EmailAdapter } from "./email.js";
import { VoiceAdapter } from "./voice.js";
const adapters = new Map([
  ["telegram", new TelegramAdapter()],
  ["discord", new DiscordAdapter()],
  ["slack", new SlackAdapter()],
  ["sms", new TwilioSmsAdapter()],
  ["whatsapp", new TwilioWhatsAppAdapter()],
  ["email", new EmailAdapter()],
  ["voice", new VoiceAdapter()],
]);
export function getAdapter(channel) {
  const adapter = adapters.get(channel);
  if (!adapter) throw new Error(`No adapter for channel: ${channel}`);
  return adapter;
}
export function getAllAdapters() {
  return [...adapters.values()];
}
export function hasAdapter(channel) {
  return adapters.has(channel);
}
export { TelegramAdapter } from "./telegram.js";
export { DiscordAdapter } from "./discord.js";
export { SlackAdapter } from "./slack.js";
export { TwilioSmsAdapter } from "./twilio-sms.js";
export { TwilioWhatsAppAdapter } from "./twilio-whatsapp.js";
export { EmailAdapter } from "./email.js";
export { VoiceAdapter } from "./voice.js";
//# sourceMappingURL=index.js.map
