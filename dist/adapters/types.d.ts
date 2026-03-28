import { z } from "zod";
export declare const ChannelTypeSchema: z.ZodEnum<
  [
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
  ]
>;
export type ChannelType = z.infer<typeof ChannelTypeSchema>;
export declare const GatewayMessageSchema: z.ZodObject<
  {
    id: z.ZodString;
    channel: z.ZodEnum<
      [
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
      ]
    >;
    from: z.ZodString;
    text: z.ZodString;
    timestamp: z.ZodNumber;
    threadId: z.ZodOptional<z.ZodString>;
    replyTo: z.ZodOptional<z.ZodString>;
    attachments: z.ZodOptional<
      z.ZodArray<
        z.ZodObject<
          {
            type: z.ZodEnum<["image", "audio", "video", "file"]>;
            url: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
            mimeType: z.ZodOptional<z.ZodString>;
          },
          "strip",
          z.ZodTypeAny,
          {
            type: "image" | "audio" | "video" | "file";
            url: string;
            name?: string | undefined;
            mimeType?: string | undefined;
          },
          {
            type: "image" | "audio" | "video" | "file";
            url: string;
            name?: string | undefined;
            mimeType?: string | undefined;
          }
        >,
        "many"
      >
    >;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
  },
  "strip",
  z.ZodTypeAny,
  {
    id: string;
    channel:
      | "telegram"
      | "discord"
      | "slack"
      | "sms"
      | "whatsapp"
      | "email"
      | "voice"
      | "teams"
      | "messenger"
      | "web";
    from: string;
    text: string;
    timestamp: number;
    threadId?: string | undefined;
    replyTo?: string | undefined;
    attachments?:
      | {
          type: "image" | "audio" | "video" | "file";
          url: string;
          name?: string | undefined;
          mimeType?: string | undefined;
        }[]
      | undefined;
    metadata?: Record<string, unknown> | undefined;
  },
  {
    id: string;
    channel:
      | "telegram"
      | "discord"
      | "slack"
      | "sms"
      | "whatsapp"
      | "email"
      | "voice"
      | "teams"
      | "messenger"
      | "web";
    from: string;
    text: string;
    timestamp: number;
    threadId?: string | undefined;
    replyTo?: string | undefined;
    attachments?:
      | {
          type: "image" | "audio" | "video" | "file";
          url: string;
          name?: string | undefined;
          mimeType?: string | undefined;
        }[]
      | undefined;
    metadata?: Record<string, unknown> | undefined;
  }
>;
export type GatewayMessage = z.infer<typeof GatewayMessageSchema>;
export declare const ActionSchema: z.ZodObject<
  {
    label: z.ZodString;
    type: z.ZodEnum<["url", "callback", "reply"]>;
    value: z.ZodString;
  },
  "strip",
  z.ZodTypeAny,
  {
    value: string;
    type: "url" | "callback" | "reply";
    label: string;
  },
  {
    value: string;
    type: "url" | "callback" | "reply";
    label: string;
  }
>;
export type Action = z.infer<typeof ActionSchema>;
export declare const RichCardSchema: z.ZodObject<
  {
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    imageUrl: z.ZodOptional<z.ZodString>;
    actions: z.ZodOptional<
      z.ZodArray<
        z.ZodObject<
          {
            label: z.ZodString;
            type: z.ZodEnum<["url", "callback", "reply"]>;
            value: z.ZodString;
          },
          "strip",
          z.ZodTypeAny,
          {
            value: string;
            type: "url" | "callback" | "reply";
            label: string;
          },
          {
            value: string;
            type: "url" | "callback" | "reply";
            label: string;
          }
        >,
        "many"
      >
    >;
  },
  "strip",
  z.ZodTypeAny,
  {
    title: string;
    description?: string | undefined;
    imageUrl?: string | undefined;
    actions?:
      | {
          value: string;
          type: "url" | "callback" | "reply";
          label: string;
        }[]
      | undefined;
  },
  {
    title: string;
    description?: string | undefined;
    imageUrl?: string | undefined;
    actions?:
      | {
          value: string;
          type: "url" | "callback" | "reply";
          label: string;
        }[]
      | undefined;
  }
>;
export type RichCard = z.infer<typeof RichCardSchema>;
export declare const GatewayResponseSchema: z.ZodObject<
  {
    text: z.ZodString;
    cards: z.ZodOptional<
      z.ZodArray<
        z.ZodObject<
          {
            title: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            imageUrl: z.ZodOptional<z.ZodString>;
            actions: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    label: z.ZodString;
                    type: z.ZodEnum<["url", "callback", "reply"]>;
                    value: z.ZodString;
                  },
                  "strip",
                  z.ZodTypeAny,
                  {
                    value: string;
                    type: "url" | "callback" | "reply";
                    label: string;
                  },
                  {
                    value: string;
                    type: "url" | "callback" | "reply";
                    label: string;
                  }
                >,
                "many"
              >
            >;
          },
          "strip",
          z.ZodTypeAny,
          {
            title: string;
            description?: string | undefined;
            imageUrl?: string | undefined;
            actions?:
              | {
                  value: string;
                  type: "url" | "callback" | "reply";
                  label: string;
                }[]
              | undefined;
          },
          {
            title: string;
            description?: string | undefined;
            imageUrl?: string | undefined;
            actions?:
              | {
                  value: string;
                  type: "url" | "callback" | "reply";
                  label: string;
                }[]
              | undefined;
          }
        >,
        "many"
      >
    >;
    actions: z.ZodOptional<
      z.ZodArray<
        z.ZodObject<
          {
            label: z.ZodString;
            type: z.ZodEnum<["url", "callback", "reply"]>;
            value: z.ZodString;
          },
          "strip",
          z.ZodTypeAny,
          {
            value: string;
            type: "url" | "callback" | "reply";
            label: string;
          },
          {
            value: string;
            type: "url" | "callback" | "reply";
            label: string;
          }
        >,
        "many"
      >
    >;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
  },
  "strip",
  z.ZodTypeAny,
  {
    text: string;
    metadata?: Record<string, unknown> | undefined;
    actions?:
      | {
          value: string;
          type: "url" | "callback" | "reply";
          label: string;
        }[]
      | undefined;
    cards?:
      | {
          title: string;
          description?: string | undefined;
          imageUrl?: string | undefined;
          actions?:
            | {
                value: string;
                type: "url" | "callback" | "reply";
                label: string;
              }[]
            | undefined;
        }[]
      | undefined;
  },
  {
    text: string;
    metadata?: Record<string, unknown> | undefined;
    actions?:
      | {
          value: string;
          type: "url" | "callback" | "reply";
          label: string;
        }[]
      | undefined;
    cards?:
      | {
          title: string;
          description?: string | undefined;
          imageUrl?: string | undefined;
          actions?:
            | {
                value: string;
                type: "url" | "callback" | "reply";
                label: string;
              }[]
            | undefined;
        }[]
      | undefined;
  }
>;
export type GatewayResponse = z.infer<typeof GatewayResponseSchema>;
export declare const ChannelConfigSchema: z.ZodObject<
  {
    channel: z.ZodEnum<
      [
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
      ]
    >;
    enabled: z.ZodDefault<z.ZodBoolean>;
    credentials: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    webhookUrl: z.ZodOptional<z.ZodString>;
    options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
  },
  "strip",
  z.ZodTypeAny,
  {
    channel:
      | "telegram"
      | "discord"
      | "slack"
      | "sms"
      | "whatsapp"
      | "email"
      | "voice"
      | "teams"
      | "messenger"
      | "web";
    enabled: boolean;
    credentials?: Record<string, string> | undefined;
    options?: Record<string, unknown> | undefined;
    webhookUrl?: string | undefined;
  },
  {
    channel:
      | "telegram"
      | "discord"
      | "slack"
      | "sms"
      | "whatsapp"
      | "email"
      | "voice"
      | "teams"
      | "messenger"
      | "web";
    credentials?: Record<string, string> | undefined;
    options?: Record<string, unknown> | undefined;
    enabled?: boolean | undefined;
    webhookUrl?: string | undefined;
  }
>;
export type ChannelConfig = z.infer<typeof ChannelConfigSchema>;
export interface ChannelStatus {
  channel: ChannelType;
  connected: boolean;
  latencyMs: number | null;
  lastMessage: number | null;
  error: string | null;
}
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
  test(): Promise<{
    ok: boolean;
    error?: string;
  }>;
  status(): Promise<ChannelStatus>;
}
export declare const IdentityChannelSchema: z.ZodObject<
  {
    enabled: z.ZodDefault<z.ZodBoolean>;
    handle: z.ZodOptional<z.ZodString>;
    webhook: z.ZodOptional<z.ZodString>;
  },
  "strip",
  z.ZodTypeAny,
  {
    enabled: boolean;
    handle?: string | undefined;
    webhook?: string | undefined;
  },
  {
    enabled?: boolean | undefined;
    handle?: string | undefined;
    webhook?: string | undefined;
  }
>;
export declare const IdentitySchema: z.ZodObject<
  {
    name: z.ZodString;
    tagline: z.ZodOptional<z.ZodString>;
    version: z.ZodDefault<z.ZodString>;
    agent_url: z.ZodOptional<z.ZodString>;
    channels: z.ZodOptional<
      z.ZodRecord<
        z.ZodEnum<
          [
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
          ]
        >,
        z.ZodObject<
          {
            enabled: z.ZodDefault<z.ZodBoolean>;
            handle: z.ZodOptional<z.ZodString>;
            webhook: z.ZodOptional<z.ZodString>;
          },
          "strip",
          z.ZodTypeAny,
          {
            enabled: boolean;
            handle?: string | undefined;
            webhook?: string | undefined;
          },
          {
            enabled?: boolean | undefined;
            handle?: string | undefined;
            webhook?: string | undefined;
          }
        >
      >
    >;
  },
  "strip",
  z.ZodTypeAny,
  {
    name: string;
    version: string;
    tagline?: string | undefined;
    agent_url?: string | undefined;
    channels?:
      | Partial<
          Record<
            | "telegram"
            | "discord"
            | "slack"
            | "sms"
            | "whatsapp"
            | "email"
            | "voice"
            | "teams"
            | "messenger"
            | "web",
            {
              enabled: boolean;
              handle?: string | undefined;
              webhook?: string | undefined;
            }
          >
        >
      | undefined;
  },
  {
    name: string;
    tagline?: string | undefined;
    version?: string | undefined;
    agent_url?: string | undefined;
    channels?:
      | Partial<
          Record<
            | "telegram"
            | "discord"
            | "slack"
            | "sms"
            | "whatsapp"
            | "email"
            | "voice"
            | "teams"
            | "messenger"
            | "web",
            {
              enabled?: boolean | undefined;
              handle?: string | undefined;
              webhook?: string | undefined;
            }
          >
        >
      | undefined;
  }
>;
export type Identity = z.infer<typeof IdentitySchema>;
export declare const AgentDialConfigSchema: z.ZodObject<
  {
    identityFile: z.ZodDefault<z.ZodString>;
    agentUrl: z.ZodOptional<z.ZodString>;
    gatewayPort: z.ZodDefault<z.ZodNumber>;
    channels: z.ZodOptional<
      z.ZodRecord<
        z.ZodEnum<
          [
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
          ]
        >,
        z.ZodObject<
          {
            channel: z.ZodEnum<
              [
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
              ]
            >;
            enabled: z.ZodDefault<z.ZodBoolean>;
            credentials: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            webhookUrl: z.ZodOptional<z.ZodString>;
            options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
          },
          "strip",
          z.ZodTypeAny,
          {
            channel:
              | "telegram"
              | "discord"
              | "slack"
              | "sms"
              | "whatsapp"
              | "email"
              | "voice"
              | "teams"
              | "messenger"
              | "web";
            enabled: boolean;
            credentials?: Record<string, string> | undefined;
            options?: Record<string, unknown> | undefined;
            webhookUrl?: string | undefined;
          },
          {
            channel:
              | "telegram"
              | "discord"
              | "slack"
              | "sms"
              | "whatsapp"
              | "email"
              | "voice"
              | "teams"
              | "messenger"
              | "web";
            credentials?: Record<string, string> | undefined;
            options?: Record<string, unknown> | undefined;
            enabled?: boolean | undefined;
            webhookUrl?: string | undefined;
          }
        >
      >
    >;
    logLevel: z.ZodDefault<z.ZodEnum<["debug", "info", "warn", "error"]>>;
  },
  "strip",
  z.ZodTypeAny,
  {
    identityFile: string;
    gatewayPort: number;
    logLevel: "debug" | "info" | "warn" | "error";
    channels?:
      | Partial<
          Record<
            | "telegram"
            | "discord"
            | "slack"
            | "sms"
            | "whatsapp"
            | "email"
            | "voice"
            | "teams"
            | "messenger"
            | "web",
            {
              channel:
                | "telegram"
                | "discord"
                | "slack"
                | "sms"
                | "whatsapp"
                | "email"
                | "voice"
                | "teams"
                | "messenger"
                | "web";
              enabled: boolean;
              credentials?: Record<string, string> | undefined;
              options?: Record<string, unknown> | undefined;
              webhookUrl?: string | undefined;
            }
          >
        >
      | undefined;
    agentUrl?: string | undefined;
  },
  {
    channels?:
      | Partial<
          Record<
            | "telegram"
            | "discord"
            | "slack"
            | "sms"
            | "whatsapp"
            | "email"
            | "voice"
            | "teams"
            | "messenger"
            | "web",
            {
              channel:
                | "telegram"
                | "discord"
                | "slack"
                | "sms"
                | "whatsapp"
                | "email"
                | "voice"
                | "teams"
                | "messenger"
                | "web";
              credentials?: Record<string, string> | undefined;
              options?: Record<string, unknown> | undefined;
              enabled?: boolean | undefined;
              webhookUrl?: string | undefined;
            }
          >
        >
      | undefined;
    identityFile?: string | undefined;
    agentUrl?: string | undefined;
    gatewayPort?: number | undefined;
    logLevel?: "debug" | "info" | "warn" | "error" | undefined;
  }
>;
export type AgentDialConfig = z.infer<typeof AgentDialConfigSchema>;
//# sourceMappingURL=types.d.ts.map
