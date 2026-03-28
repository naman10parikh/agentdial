import { z } from "zod";

// ── Channel Types ──

export const ChannelTypeSchema = z.enum([
  "telegram",
  "discord",
  "slack",
  "sms",
  "whatsapp",
  "email",
  "voice",
  "teams",
  "messenger",
  "web",
]);

export type ChannelType = z.infer<typeof ChannelTypeSchema>;

// ── Gateway Message (incoming from any channel) ──

export const GatewayMessageSchema = z.object({
  id: z.string(),
  channel: ChannelTypeSchema,
  from: z.string(),
  text: z.string(),
  timestamp: z.number(),
  threadId: z.string().optional(),
  replyTo: z.string().optional(),
  attachments: z
    .array(
      z.object({
        type: z.enum(["image", "audio", "video", "file"]),
        url: z.string(),
        name: z.string().optional(),
        mimeType: z.string().optional(),
      }),
    )
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type GatewayMessage = z.infer<typeof GatewayMessageSchema>;

// ── Rich Card (for structured responses) ──

export const ActionSchema = z.object({
  label: z.string(),
  type: z.enum(["url", "callback", "reply"]),
  value: z.string(),
});

export type Action = z.infer<typeof ActionSchema>;

export const RichCardSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  actions: z.array(ActionSchema).optional(),
});

export type RichCard = z.infer<typeof RichCardSchema>;

// ── Gateway Response (outgoing to any channel) ──

export const GatewayResponseSchema = z.object({
  text: z.string(),
  cards: z.array(RichCardSchema).optional(),
  actions: z.array(ActionSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type GatewayResponse = z.infer<typeof GatewayResponseSchema>;

// ── Channel Config ──

export const ChannelConfigSchema = z.object({
  channel: ChannelTypeSchema,
  enabled: z.boolean().default(false),
  credentials: z.record(z.string()).optional(),
  webhookUrl: z.string().optional(),
  options: z.record(z.unknown()).optional(),
});

export type ChannelConfig = z.infer<typeof ChannelConfigSchema>;

// ── Channel Status ──

export interface ChannelStatus {
  channel: ChannelType;
  connected: boolean;
  latencyMs: number | null;
  lastMessage: number | null;
  error: string | null;
}

// ── Channel Adapter Interface ──

export interface ChannelAdapter {
  readonly name: ChannelType;
  readonly displayName: string;
  readonly free: boolean;
  readonly cost?: string;
  readonly setupTime: string;

  setup(config: ChannelConfig): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(to: string, response: GatewayResponse): Promise<void>;
  onMessage(handler: (msg: GatewayMessage) => Promise<GatewayResponse>): void;
  test(): Promise<{ ok: boolean; error?: string }>;
  status(): Promise<ChannelStatus>;
}

// ── Identity (parsed from IDENTITY.md) ──

export const IdentityChannelSchema = z.object({
  enabled: z.boolean().default(false),
  handle: z.string().optional(),
  webhook: z.string().optional(),
});

export const IdentitySchema = z.object({
  name: z.string(),
  tagline: z.string().optional(),
  version: z.string().default("1.0.0"),
  agent_url: z.string().optional(),
  channels: z.record(ChannelTypeSchema, IdentityChannelSchema).optional(),
});

export type Identity = z.infer<typeof IdentitySchema>;

// ── Agent Dial Config ──

export const AgentDialConfigSchema = z.object({
  identityFile: z.string().default("IDENTITY.md"),
  agentUrl: z.string().optional(),
  gatewayPort: z.number().default(3141),
  channels: z.record(ChannelTypeSchema, ChannelConfigSchema).optional(),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type AgentDialConfig = z.infer<typeof AgentDialConfigSchema>;
