import type {
  ChannelType,
  GatewayMessage,
  GatewayResponse,
} from "../adapters/types.js";
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
export declare function normalizeMessage(
  raw: RawChannelMessage,
  channel: ChannelType,
): GatewayMessage;
interface ChannelFormattedResponse {
  channel: ChannelType;
  payload: Record<string, unknown>;
}
export declare function formatResponse(
  response: GatewayResponse,
  channel: ChannelType,
): ChannelFormattedResponse;
export declare function routeMessage(
  msg: GatewayMessage,
  agentUrl: string,
): Promise<GatewayResponse>;
export {};
//# sourceMappingURL=gateway.d.ts.map
