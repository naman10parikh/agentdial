import type { ChannelAdapter, ChannelType } from "./types.js";
export declare function getAdapter(channel: ChannelType): ChannelAdapter;
export declare function getAllAdapters(): ChannelAdapter[];
export declare function hasAdapter(channel: ChannelType): boolean;
export { TelegramAdapter } from "./telegram.js";
export { DiscordAdapter } from "./discord.js";
export { SlackAdapter } from "./slack.js";
export { TwilioSmsAdapter } from "./twilio-sms.js";
export { TwilioWhatsAppAdapter } from "./twilio-whatsapp.js";
export { EmailAdapter } from "./email.js";
export { VoiceAdapter } from "./voice.js";
//# sourceMappingURL=index.d.ts.map
