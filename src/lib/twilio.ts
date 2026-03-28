/**
 * Shared Twilio API helpers used by SMS, WhatsApp, and Voice adapters.
 */

export const TWILIO_API_BASE =
  "https://api.twilio.com/2010-04-01/Accounts/" as const;

export interface TwilioApiResponse {
  sid?: string;
  status?: string;
  message?: string;
  code?: number;
  friendly_name?: string;
  incoming_phone_number?: Array<{ phone_number: string; status: string }>;
}

export function basicAuth(sid: string, token: string): string {
  return `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;
}

export async function twilioFetch(
  accountSid: string,
  authToken: string,
  path: string,
  options: RequestInit = {},
): Promise<TwilioApiResponse> {
  const url = `${TWILIO_API_BASE}${accountSid}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: basicAuth(accountSid, authToken),
      "Content-Type": "application/x-www-form-urlencoded",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio API ${res.status}: ${text}`);
  }
  return res.json() as Promise<TwilioApiResponse>;
}
