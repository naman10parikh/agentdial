import type {
  ChannelAdapter,
  ChannelConfig,
  ChannelStatus,
  GatewayMessage,
  GatewayResponse,
} from "./types.js";
export type VoiceProvider =
  | "openai-realtime"
  | "elevenlabs"
  | "deepgram"
  | "vapi"
  | "livekit"
  | "custom";
export interface VoiceProviderMeta {
  id: VoiceProvider;
  name: string;
  cost: string;
  description: string;
  credentialKeys: string[];
}
export declare const VOICE_PROVIDERS: VoiceProviderMeta[];
export interface TwilioVoicePayload {
  CallSid: string;
  From: string;
  To: string;
  CallStatus: string;
  Direction: string;
  SpeechResult?: string;
  Confidence?: string;
  Digits?: string;
  [key: string]: string | undefined;
}
export declare class VoiceAdapter implements ChannelAdapter {
  readonly name: "voice";
  readonly displayName = "Voice (Twilio)";
  readonly free = false;
  readonly cost = "$0.014/min + provider";
  readonly setupTime = "5 min";
  private accountSid;
  private authToken;
  private phoneNumber;
  private webhookUrl;
  private voiceProvider;
  private messageHandler;
  private connected;
  private lastMessageTs;
  setup(config: ChannelConfig): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(_to: string, _response: GatewayResponse): Promise<void>;
  onMessage(handler: (msg: GatewayMessage) => Promise<GatewayResponse>): void;
  /**
   * Handle incoming Twilio voice webhook.
   * Returns TwiML that gathers speech, sends it to the agent, and speaks the response.
   */
  handleWebhook(payload: TwilioVoicePayload): Promise<string>;
  test(): Promise<{
    ok: boolean;
    error?: string;
  }>;
  status(): Promise<ChannelStatus>;
  /** Current voice provider selection */
  getProvider(): VoiceProvider;
}
//# sourceMappingURL=voice.d.ts.map
