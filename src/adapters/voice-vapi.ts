import { getCredential, saveCredential } from "../lib/credentials.js";
import type { ChannelType } from "./types.js";

/** Credential channel key — uses "voice" since ChannelType is a fixed enum. */
const CRED_CHANNEL: ChannelType = "voice";
import type {
  ChannelAdapter,
  ChannelConfig,
  ChannelStatus,
  GatewayMessage,
  GatewayResponse,
} from "./types.js";

// ── VAPI API Types ──

const VAPI_API = "https://api.vapi.ai";

interface VapiAssistant {
  id: string;
  name: string;
  firstMessage?: string;
  serverUrl?: string;
  model?: { provider: string; model: string };
}

interface VapiPhoneNumber {
  id: string;
  number: string;
  provider: string;
  assistantId?: string;
}

interface VapiCall {
  id: string;
  status: string;
  assistantId?: string;
  phoneNumberId?: string;
}

/** Webhook payload VAPI sends to our serverUrl. */
export interface VapiWebhookPayload {
  message: {
    type:
      | "conversation-update"
      | "end-of-call-report"
      | "status-update"
      | "transcript"
      | "function-call"
      | "assistant-request"
      | "hang";
    call?: {
      id: string;
      phoneNumberId?: string;
      customer?: { number: string };
    };
    transcript?: string;
    /** For conversation-update — array of message objects */
    conversation?: Array<{ role: string; content: string }>;
    /** For end-of-call-report */
    summary?: string;
    endedReason?: string;
    /** For function-call */
    functionCall?: { name: string; parameters: Record<string, unknown> };
    /** For status-update */
    status?: string;
    [key: string]: unknown;
  };
}

// ── Helpers ──

async function vapiFetch(
  apiKey: string,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${VAPI_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

// ── VAPI Voice Adapter ──

export class VapiVoiceAdapter implements ChannelAdapter {
  readonly name = "voice" as const;
  readonly displayName = "Voice (VAPI)";
  readonly free = true;
  readonly cost = "$0.05/min (10 free US numbers)";
  readonly setupTime = "3 min";

  private apiKey = "";
  private assistantId = "";
  private phoneNumberId = "";
  private phoneNumber = "";
  private messageHandler:
    | ((msg: GatewayMessage) => Promise<GatewayResponse>)
    | null = null;
  private connected = false;
  private lastMessageTs: number | null = null;

  async setup(config: ChannelConfig): Promise<void> {
    this.apiKey =
      config.credentials?.vapi_api_key ??
      (await getCredential(CRED_CHANNEL, "vapi_api_key")) ??
      "";
    this.assistantId =
      config.credentials?.assistant_id ??
      (await getCredential(CRED_CHANNEL, "assistant_id")) ??
      "";
    this.phoneNumberId =
      config.credentials?.phone_number_id ??
      (await getCredential(CRED_CHANNEL, "phone_number_id")) ??
      "";
    this.phoneNumber =
      config.credentials?.phone_number ??
      (await getCredential(CRED_CHANNEL, "phone_number")) ??
      "";

    if (!this.apiKey) {
      throw new Error(
        "VAPI voice adapter requires vapi_api_key. " +
          "Sign up at https://vapi.ai and get your API key from the dashboard.",
      );
    }

    // Validate the API key
    const res = await vapiFetch(this.apiKey, "/assistant");
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`VAPI API key invalid: ${body}`);
    }
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  /**
   * Provision a VAPI phone number and assistant.
   * Call this after setup() to auto-create resources.
   */
  async provision(opts: {
    serverUrl: string;
    firstMessage?: string;
    assistantName?: string;
  }): Promise<{
    assistantId: string;
    phoneNumberId: string;
    phoneNumber: string;
  }> {
    // 1. Create assistant with our serverUrl as webhook
    const assistantRes = await vapiFetch(this.apiKey, "/assistant", {
      method: "POST",
      body: JSON.stringify({
        name: opts.assistantName ?? "AgentDial Voice",
        firstMessage: opts.firstMessage ?? "Hello! How can I help you today?",
        serverUrl: opts.serverUrl,
        model: {
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
        },
      }),
    });

    if (!assistantRes.ok) {
      const err = await assistantRes.text();
      throw new Error(`Failed to create VAPI assistant: ${err}`);
    }

    const assistant = (await assistantRes.json()) as VapiAssistant;
    this.assistantId = assistant.id;
    await saveCredential(CRED_CHANNEL, "assistant_id", assistant.id);

    // 2. Provision a free VAPI phone number
    const phoneRes = await vapiFetch(this.apiKey, "/phone-number", {
      method: "POST",
      body: JSON.stringify({
        provider: "vapi",
        assistantId: assistant.id,
      }),
    });

    if (!phoneRes.ok) {
      const err = await phoneRes.text();
      throw new Error(`Failed to provision phone number: ${err}`);
    }

    const phone = (await phoneRes.json()) as VapiPhoneNumber;
    this.phoneNumberId = phone.id;
    this.phoneNumber = phone.number;
    await saveCredential(CRED_CHANNEL, "phone_number_id", phone.id);
    await saveCredential(CRED_CHANNEL, "phone_number", phone.number);

    return {
      assistantId: assistant.id,
      phoneNumberId: phone.id,
      phoneNumber: phone.number,
    };
  }

  /**
   * Handle a VAPI server URL webhook.
   * VAPI sends conversation events, transcripts, and function calls.
   */
  async handleWebhook(
    payload: VapiWebhookPayload,
  ): Promise<GatewayResponse | null> {
    this.lastMessageTs = Date.now();
    const msg = payload.message;

    // We primarily care about conversation-update with user messages
    if (msg.type === "conversation-update" && msg.conversation) {
      const lastUserMsg = [...msg.conversation]
        .reverse()
        .find((m) => m.role === "user");
      if (!lastUserMsg?.content) return null;

      const gwMsg: GatewayMessage = {
        id: msg.call?.id ?? `vapi-${Date.now()}`,
        channel: "voice",
        from: msg.call?.customer?.number ?? "unknown",
        text: lastUserMsg.content,
        timestamp: Date.now(),
        metadata: {
          callId: msg.call?.id,
          provider: "vapi",
          messageType: msg.type,
        },
      };

      if (!this.messageHandler) return null;
      return this.messageHandler(gwMsg);
    }

    // For function calls, route through the message handler as a special message
    if (msg.type === "function-call" && msg.functionCall) {
      const gwMsg: GatewayMessage = {
        id: msg.call?.id ?? `vapi-fn-${Date.now()}`,
        channel: "voice",
        from: msg.call?.customer?.number ?? "unknown",
        text: `[function-call] ${msg.functionCall.name}: ${JSON.stringify(msg.functionCall.parameters)}`,
        timestamp: Date.now(),
        metadata: {
          callId: msg.call?.id,
          provider: "vapi",
          messageType: "function-call",
          functionName: msg.functionCall.name,
          functionParams: msg.functionCall.parameters,
        },
      };

      if (!this.messageHandler) return null;
      return this.messageHandler(gwMsg);
    }

    // Other events (status-update, end-of-call-report, hang) — acknowledge but no response
    return null;
  }

  /** Make an outbound call via VAPI. */
  async send(to: string, _response: GatewayResponse): Promise<void> {
    if (!this.assistantId) {
      throw new Error("No VAPI assistant configured. Run provision() first.");
    }

    const res = await vapiFetch(this.apiKey, "/call", {
      method: "POST",
      body: JSON.stringify({
        assistantId: this.assistantId,
        phoneNumberId: this.phoneNumberId || undefined,
        customer: { number: to },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`VAPI outbound call failed: ${err}`);
    }
  }

  onMessage(handler: (msg: GatewayMessage) => Promise<GatewayResponse>): void {
    this.messageHandler = handler;
  }

  async test(): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await vapiFetch(this.apiKey, "/assistant");
      if (!res.ok) {
        return { ok: false, error: `VAPI API returned ${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  async status(): Promise<ChannelStatus> {
    const start = Date.now();
    try {
      const res = await vapiFetch(this.apiKey, "/assistant");
      return {
        channel: "voice",
        connected: this.connected && res.ok,
        latencyMs: Date.now() - start,
        lastMessage: this.lastMessageTs,
        error: res.ok ? null : `VAPI API returned ${res.status}`,
      };
    } catch (err) {
      return {
        channel: "voice",
        connected: false,
        latencyMs: Date.now() - start,
        lastMessage: this.lastMessageTs,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  /** List provisioned phone numbers. */
  async listPhoneNumbers(): Promise<VapiPhoneNumber[]> {
    const res = await vapiFetch(this.apiKey, "/phone-number");
    if (!res.ok) return [];
    return (await res.json()) as VapiPhoneNumber[];
  }

  /** List assistants. */
  async listAssistants(): Promise<VapiAssistant[]> {
    const res = await vapiFetch(this.apiKey, "/assistant");
    if (!res.ok) return [];
    return (await res.json()) as VapiAssistant[];
  }
}
