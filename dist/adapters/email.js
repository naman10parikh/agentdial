import { getCredential } from "../lib/credentials.js";
const SENDGRID_API = "https://api.sendgrid.com/v3";
async function sendgridFetch(apiKey, path, options = {}) {
  const res = await fetch(`${SENDGRID_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  return res;
}
function extractEmail(raw) {
  // Handle "Name <email@example.com>" format
  const match = raw.match(/<([^>]+)>/);
  return match ? match[1] : raw.trim();
}
function responseToHtml(response) {
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
export class EmailAdapter {
  name = "email";
  displayName = "Email (SendGrid)";
  free = false;
  cost = "100/day free, then $0.001/msg";
  setupTime = "3 min";
  apiKey = "";
  fromEmail = "";
  fromName = "";
  messageHandler = null;
  connected = false;
  lastMessageTs = null;
  async setup(config) {
    this.apiKey =
      config.credentials?.apiKey ??
      (await getCredential("email", "apiKey")) ??
      "";
    this.fromEmail =
      config.credentials?.fromEmail ??
      (await getCredential("email", "fromEmail")) ??
      "";
    this.fromName =
      config.credentials?.fromName ??
      (await getCredential("email", "fromName")) ??
      "Agent";
    if (!this.apiKey || !this.fromEmail) {
      throw new Error("Email adapter requires apiKey and fromEmail");
    }
    // Validate API key
    const res = await sendgridFetch(this.apiKey, "/user/profile");
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SendGrid API key invalid: ${text}`);
    }
  }
  async connect() {
    // API-based, no persistent connection needed.
    // Inbound email uses SendGrid Inbound Parse webhook — configured in SG dashboard.
    this.connected = true;
  }
  async disconnect() {
    this.connected = false;
  }
  async send(to, response) {
    const subject = response.metadata?.subject ?? "New message";
    const body = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: this.fromEmail, name: this.fromName },
      subject,
      content: [
        { type: "text/plain", value: response.text },
        { type: "text/html", value: responseToHtml(response) },
      ],
    };
    const res = await sendgridFetch(this.apiKey, "/mail/send", {
      method: "POST",
      body: JSON.stringify(body),
    });
    // SendGrid returns 202 on success, no body
    if (!res.ok) {
      const errBody = await res.json();
      const errMsg =
        errBody.errors?.map((e) => e.message).join(", ") ?? "Send failed";
      throw new Error(`SendGrid send failed: ${errMsg}`);
    }
  }
  onMessage(handler) {
    this.messageHandler = handler;
  }
  /** Call from HTTP webhook handler with parsed SendGrid Inbound Parse POST body. */
  async handleWebhook(payload) {
    this.lastMessageTs = Date.now();
    const fromEmail = extractEmail(payload.from);
    const text = payload.text ?? "";
    const subject = payload.subject ?? "";
    const msg = {
      id: `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      channel: "email",
      from: fromEmail,
      text: text || subject,
      timestamp: Date.now(),
      metadata: {
        subject,
        to: payload.to,
        html: payload.html ?? undefined,
      },
    };
    if (!this.messageHandler) return null;
    return this.messageHandler(msg);
  }
  async test() {
    try {
      const res = await sendgridFetch(this.apiKey, "/user/profile");
      if (!res.ok) {
        return { ok: false, error: `API returned ${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
  async status() {
    const start = Date.now();
    try {
      const res = await sendgridFetch(this.apiKey, "/user/profile");
      return {
        channel: "email",
        connected: this.connected && res.ok,
        latencyMs: Date.now() - start,
        lastMessage: this.lastMessageTs,
        error: res.ok ? null : `API returned ${res.status}`,
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
}
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
//# sourceMappingURL=email.js.map
