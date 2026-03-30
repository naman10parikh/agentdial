import { getCredential, saveCredential } from "../lib/credentials.js";
import type { ChannelType } from "./types.js";

/** Credential channel key — uses "email" since ChannelType is a fixed enum. */
const CRED_CHANNEL: ChannelType = "email";
import type {
  ChannelAdapter,
  ChannelConfig,
  ChannelStatus,
  GatewayMessage,
  GatewayResponse,
} from "./types.js";

// ── AgentMail API Types ──

const AGENTMAIL_API = "https://api.agentmail.to/v0";

interface AgentMailInbox {
  id: string;
  username: string;
  domain: string;
  display_name?: string;
  email_address: string;
}

interface AgentMailMessage {
  id: string;
  inbox_id: string;
  from_: string;
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  created_at: string;
}

/** Webhook payload AgentMail sends for message.received events. */
export interface AgentMailWebhookPayload {
  event: "message.received" | "message.delivered";
  inbox_id: string;
  message_id: string;
  from: string;
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  extracted_text?: string;
  [key: string]: unknown;
}

// ── Helpers ──

async function agentmailFetch(
  apiKey: string,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${AGENTMAIL_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function responseToHtml(response: GatewayResponse): string {
  let html = `<p>${escapeHtml(response.text).replace(/\n/g, "<br>")}</p>`;

  if (response.cards?.length) {
    for (const card of response.cards) {
      html += `<div style="border:1px solid #333;border-radius:8px;padding:16px;margin:12px 0;">`;
      if (card.imageUrl) {
        html += `<img src="${escapeHtml(card.imageUrl)}" style="max-width:100%;border-radius:4px;" />`;
      }
      html += `<h3 style="margin:8px 0 4px;">${escapeHtml(card.title)}</h3>`;
      if (card.description) {
        html += `<p style="color:#666;">${escapeHtml(card.description)}</p>`;
      }
      if (card.actions?.length) {
        for (const action of card.actions) {
          if (action.type === "url") {
            html += `<a href="${escapeHtml(action.value)}" style="display:inline-block;padding:8px 16px;background:#6b21a8;color:white;border-radius:4px;text-decoration:none;margin:4px 4px 4px 0;">${escapeHtml(action.label)}</a>`;
          }
        }
      }
      html += `</div>`;
    }
  }

  if (response.actions?.length) {
    html += `<div style="margin-top:12px;">`;
    for (const action of response.actions) {
      if (action.type === "url") {
        html += `<a href="${escapeHtml(action.value)}" style="display:inline-block;padding:8px 16px;background:#6b21a8;color:white;border-radius:4px;text-decoration:none;margin:4px;">${escapeHtml(action.label)}</a>`;
      }
    }
    html += `</div>`;
  }

  return html;
}

// ── AgentMail Email Adapter ──

export class AgentMailAdapter implements ChannelAdapter {
  readonly name = "email" as const;
  readonly displayName = "Email (AgentMail)";
  readonly free = true;
  readonly cost = "Free tier available, paid for custom domains";
  readonly setupTime = "2 min";

  private apiKey = "";
  private inboxId = "";
  private emailAddress = "";
  private messageHandler:
    | ((msg: GatewayMessage) => Promise<GatewayResponse>)
    | null = null;
  private connected = false;
  private lastMessageTs: number | null = null;

  async setup(config: ChannelConfig): Promise<void> {
    this.apiKey =
      config.credentials?.agentmail_api_key ??
      (await getCredential(CRED_CHANNEL, "agentmail_api_key")) ??
      "";
    this.inboxId =
      config.credentials?.inbox_id ??
      (await getCredential(CRED_CHANNEL, "inbox_id")) ??
      "";
    this.emailAddress =
      config.credentials?.email_address ??
      (await getCredential(CRED_CHANNEL, "email_address")) ??
      "";

    if (!this.apiKey) {
      throw new Error(
        "AgentMail adapter requires agentmail_api_key. " +
          "Sign up at https://agentmail.to and get your API key.",
      );
    }

    // Validate API key by listing inboxes
    const res = await agentmailFetch(this.apiKey, "/inboxes");
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AgentMail API key invalid: ${body}`);
    }
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  /**
   * Create a new inbox for the agent.
   * Returns the inbox ID and email address.
   */
  async createInbox(opts?: {
    username?: string;
    displayName?: string;
  }): Promise<{ inboxId: string; emailAddress: string }> {
    const username = opts?.username ?? `agent-${Date.now().toString(36)}`;

    const res = await agentmailFetch(this.apiKey, "/inboxes", {
      method: "POST",
      body: JSON.stringify({
        username,
        display_name: opts?.displayName ?? "AI Agent",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to create AgentMail inbox: ${err}`);
    }

    const inbox = (await res.json()) as AgentMailInbox;
    this.inboxId = inbox.id;
    this.emailAddress = inbox.email_address;

    await saveCredential(CRED_CHANNEL, "inbox_id", inbox.id);
    await saveCredential(CRED_CHANNEL, "email_address", inbox.email_address);

    return { inboxId: inbox.id, emailAddress: inbox.email_address };
  }

  /** Send an email from the agent's inbox. */
  async send(to: string, response: GatewayResponse): Promise<void> {
    if (!this.inboxId) {
      throw new Error(
        "No AgentMail inbox configured. Run createInbox() first.",
      );
    }

    const subject =
      (response.metadata?.subject as string | undefined) ?? "New message";

    const res = await agentmailFetch(
      this.apiKey,
      `/inboxes/${this.inboxId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          to: [to],
          subject,
          text: response.text,
          html: responseToHtml(response),
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`AgentMail send failed: ${err}`);
    }
  }

  onMessage(handler: (msg: GatewayMessage) => Promise<GatewayResponse>): void {
    this.messageHandler = handler;
  }

  /**
   * Handle an AgentMail webhook for inbound email.
   * Register webhook URL in AgentMail dashboard.
   */
  async handleWebhook(
    payload: AgentMailWebhookPayload,
  ): Promise<GatewayResponse | null> {
    this.lastMessageTs = Date.now();

    if (payload.event !== "message.received") return null;

    const text =
      payload.extracted_text ?? payload.text ?? payload.subject ?? "";
    const from = payload.from ?? "unknown";

    const msg: GatewayMessage = {
      id: payload.message_id ?? `am-${Date.now()}`,
      channel: "email",
      from,
      text,
      timestamp: Date.now(),
      metadata: {
        subject: payload.subject,
        inboxId: payload.inbox_id,
        provider: "agentmail",
        html: payload.html ?? undefined,
      },
    };

    if (!this.messageHandler) return null;
    return this.messageHandler(msg);
  }

  /**
   * Poll for new messages (alternative to webhooks).
   * Returns unread messages from the inbox.
   */
  async pollMessages(): Promise<AgentMailMessage[]> {
    if (!this.inboxId) return [];

    const res = await agentmailFetch(
      this.apiKey,
      `/inboxes/${this.inboxId}/messages`,
    );

    if (!res.ok) return [];
    const data = (await res.json()) as { items?: AgentMailMessage[] };
    return data.items ?? [];
  }

  async test(): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await agentmailFetch(this.apiKey, "/inboxes");
      if (!res.ok) {
        return { ok: false, error: `AgentMail API returned ${res.status}` };
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
      const res = await agentmailFetch(this.apiKey, "/inboxes");
      return {
        channel: "email",
        connected: this.connected && res.ok,
        latencyMs: Date.now() - start,
        lastMessage: this.lastMessageTs,
        error: res.ok ? null : `AgentMail API returned ${res.status}`,
      };
    } catch (err) {
      return {
        channel: "email",
        connected: false,
        latencyMs: Date.now() - start,
        lastMessage: this.lastMessageTs,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  /** List all inboxes. */
  async listInboxes(): Promise<AgentMailInbox[]> {
    const res = await agentmailFetch(this.apiKey, "/inboxes");
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: AgentMailInbox[] };
    return data.items ?? [];
  }

  /** Get the current inbox email address. */
  getEmailAddress(): string {
    return this.emailAddress;
  }
}
