/**
 * Auto-provisioning — buy/configure channels via APIs.
 * "SendBlue runs setup, gives you the number, done."
 */

import { basicAuth, TWILIO_API_BASE } from "./twilio.js";

// ── Types ──

export interface AvailableNumber {
  number: string;
  friendly: string;
  capabilities: string[];
}

export interface PurchasedNumber {
  number: string;
  sid: string;
  smsWebhook: string;
  voiceWebhook: string;
}

interface TwilioAvailableNumber {
  phone_number: string;
  friendly_name: string;
  capabilities: {
    voice: boolean;
    SMS: boolean;
    MMS: boolean;
    fax: boolean;
  };
}

interface TwilioIncomingNumber {
  phone_number: string;
  sid: string;
  sms_url: string;
  voice_url: string;
  friendly_name: string;
}

interface TwilioErrorResponse {
  code: number;
  message: string;
  status: number;
}

// ── Twilio Account Validation ──

export async function validateTwilioAccount(
  sid: string,
  token: string,
): Promise<
  { ok: true; name: string; status: string } | { ok: false; error: string }
> {
  try {
    const res = await fetch(`${TWILIO_API_BASE}${sid}.json`, {
      headers: { Authorization: basicAuth(sid, token) },
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${body}` };
    }
    const data = (await res.json()) as {
      friendly_name: string;
      status: string;
    };
    return { ok: true, name: data.friendly_name, status: data.status };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

// ── Search Available Numbers ──

export async function searchTwilioNumbers(
  sid: string,
  token: string,
  options?: {
    country?: string;
    areaCode?: string;
    contains?: string;
    limit?: number;
  },
): Promise<AvailableNumber[]> {
  const country = options?.country ?? "US";
  const params = new URLSearchParams();
  if (options?.areaCode) params.set("AreaCode", options.areaCode);
  if (options?.contains) params.set("Contains", options.contains);
  params.set("SmsEnabled", "true");
  params.set("VoiceEnabled", "true");
  params.set("PageSize", String(options?.limit ?? 5));

  const qs = params.toString();
  const url = `${TWILIO_API_BASE}${sid}/AvailablePhoneNumbers/${country}/Local.json?${qs}`;

  const res = await fetch(url, {
    headers: { Authorization: basicAuth(sid, token) },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as TwilioErrorResponse;
    throw new Error(
      `Twilio search failed (${res.status}): ${body.message ?? res.statusText}`,
    );
  }

  const data = (await res.json()) as {
    available_phone_numbers: TwilioAvailableNumber[];
  };
  return (data.available_phone_numbers ?? []).map((n) => ({
    number: n.phone_number,
    friendly: n.friendly_name,
    capabilities: [
      ...(n.capabilities.voice ? ["voice"] : []),
      ...(n.capabilities.SMS ? ["sms"] : []),
      ...(n.capabilities.MMS ? ["mms"] : []),
    ],
  }));
}

// ── Buy a Number ──

export async function buyTwilioNumber(
  sid: string,
  token: string,
  phoneNumber: string,
  webhookBaseUrl: string,
): Promise<PurchasedNumber> {
  const smsWebhook = `${webhookBaseUrl}/webhook/sms`;
  const voiceWebhook = `${webhookBaseUrl}/webhook/voice`;

  const params = new URLSearchParams({
    PhoneNumber: phoneNumber,
    SmsUrl: smsWebhook,
    SmsMethod: "POST",
    VoiceUrl: voiceWebhook,
    VoiceMethod: "POST",
    FriendlyName: "agentdial",
  });

  const url = `${TWILIO_API_BASE}${sid}/IncomingPhoneNumbers.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: basicAuth(sid, token),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as TwilioErrorResponse;
    throw new Error(
      `Failed to buy number (${res.status}): ${body.message ?? res.statusText}`,
    );
  }

  const data = (await res.json()) as TwilioIncomingNumber;
  return {
    number: data.phone_number,
    sid: data.sid,
    smsWebhook: data.sms_url,
    voiceWebhook: data.voice_url,
  };
}

// ── Configure Webhooks on Existing Number ──

export async function configureTwilioWebhooks(
  sid: string,
  token: string,
  numberSid: string,
  webhookBaseUrl: string,
): Promise<void> {
  const smsWebhook = `${webhookBaseUrl}/webhook/sms`;
  const voiceWebhook = `${webhookBaseUrl}/webhook/voice`;

  const params = new URLSearchParams({
    SmsUrl: smsWebhook,
    SmsMethod: "POST",
    VoiceUrl: voiceWebhook,
    VoiceMethod: "POST",
  });

  const url = `${TWILIO_API_BASE}${sid}/IncomingPhoneNumbers/${numberSid}.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: basicAuth(sid, token),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as TwilioErrorResponse;
    throw new Error(
      `Failed to configure webhooks (${res.status}): ${body.message ?? res.statusText}`,
    );
  }
}

// ── List Existing Numbers on Account ──

export async function listTwilioNumbers(
  sid: string,
  token: string,
): Promise<{ number: string; sid: string; friendly: string }[]> {
  const url = `${TWILIO_API_BASE}${sid}/IncomingPhoneNumbers.json?PageSize=20`;
  const res = await fetch(url, {
    headers: { Authorization: basicAuth(sid, token) },
  });

  if (!res.ok) return [];

  const data = (await res.json()) as {
    incoming_phone_numbers: TwilioIncomingNumber[];
  };
  return (data.incoming_phone_numbers ?? []).map((n) => ({
    number: n.phone_number,
    sid: n.sid,
    friendly: n.friendly_name,
  }));
}

// ── Format Phone Number for Display ──

export function formatPhone(raw: string): string {
  // +1XXXXXXXXXX → +1 (XXX) XXX-XXXX
  const match = raw.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (match) return `+1 (${match[1]}) ${match[2]}-${match[3]}`;
  return raw;
}

// ── Telegram Bot Validation ──

export async function validateTelegramToken(
  token: string,
): Promise<
  | { ok: true; username: string; displayName: string }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as {
      ok: boolean;
      result?: { username: string; first_name: string };
    };
    if (!data.ok || !data.result) {
      return { ok: false, error: "Invalid token" };
    }
    return {
      ok: true,
      username: data.result.username,
      displayName: data.result.first_name,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}
