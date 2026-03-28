import { randomUUID } from "node:crypto";
import {
  GatewayMessageSchema,
  GatewayResponseSchema,
} from "../adapters/types.js";
import type {
  ChannelType,
  GatewayMessage,
  GatewayResponse,
} from "../adapters/types.js";

// ── Normalize incoming messages from any channel ──

interface RawChannelMessage {
  text?: string;
  content?: string;
  body?: string;
  message?: string;
  from?: string;
  sender?: string;
  userId?: string;
  user_id?: string;
  chatId?: string;
  chat_id?: string;
  threadId?: string;
  thread_id?: string;
  timestamp?: number;
  date?: number;
  ts?: string;
}

export function normalizeMessage(
  raw: RawChannelMessage,
  channel: ChannelType,
): GatewayMessage {
  const text = raw.text ?? raw.content ?? raw.body ?? raw.message ?? "";
  const from = raw.from ?? raw.sender ?? raw.userId ?? raw.user_id ?? "unknown";
  const threadId =
    raw.threadId ?? raw.thread_id ?? raw.chatId ?? raw.chat_id ?? undefined;
  const timestamp =
    raw.timestamp ?? raw.date ?? parseSlackTs(raw.ts) ?? Date.now();

  const msg: GatewayMessage = {
    id: randomUUID(),
    channel,
    from: String(from),
    text: String(text),
    timestamp,
    threadId: threadId ? String(threadId) : undefined,
  };

  return GatewayMessageSchema.parse(msg);
}

function parseSlackTs(ts: string | undefined): number | undefined {
  if (!ts) return undefined;
  const seconds = parseFloat(ts);
  if (isNaN(seconds)) return undefined;
  return Math.floor(seconds * 1000);
}

// ── Format response for a specific channel ──

interface ChannelFormattedResponse {
  channel: ChannelType;
  payload: Record<string, unknown>;
}

export function formatResponse(
  response: GatewayResponse,
  channel: ChannelType,
): ChannelFormattedResponse {
  const validated = GatewayResponseSchema.parse(response);

  switch (channel) {
    case "telegram":
      return {
        channel,
        payload: {
          text: validated.text,
          parse_mode: "Markdown",
          reply_markup: validated.actions
            ? {
                inline_keyboard: [
                  validated.actions.map((a) => ({
                    text: a.label,
                    ...(a.type === "url"
                      ? { url: a.value }
                      : { callback_data: a.value }),
                  })),
                ],
              }
            : undefined,
        },
      };

    case "discord":
      return {
        channel,
        payload: {
          content: validated.text,
          embeds: validated.cards?.map((c) => ({
            title: c.title,
            description: c.description,
            image: c.imageUrl ? { url: c.imageUrl } : undefined,
          })),
        },
      };

    case "slack":
      return {
        channel,
        payload: {
          text: validated.text,
          blocks: [
            { type: "section", text: { type: "mrkdwn", text: validated.text } },
            ...(validated.actions?.map((a) => ({
              type: "actions",
              elements: [
                {
                  type: a.type === "url" ? "button" : "button",
                  text: { type: "plain_text", text: a.label },
                  ...(a.type === "url" ? { url: a.value } : { value: a.value }),
                },
              ],
            })) ?? []),
          ],
        },
      };

    default:
      return {
        channel,
        payload: { text: validated.text },
      };
  }
}

// ── Route message to agent backend ──

export async function routeMessage(
  msg: GatewayMessage,
  agentUrl: string,
): Promise<GatewayResponse> {
  const res = await fetch(agentUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(msg),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "unknown error");
    throw new Error(`Agent returned ${String(res.status)}: ${body}`);
  }

  const data = (await res.json()) as unknown;
  return GatewayResponseSchema.parse(data);
}
