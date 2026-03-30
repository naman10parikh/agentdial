/**
 * Slack app creation via the Manifest API.
 * Creates a fully-configured Slack app with one API call.
 */

// ── Types ──

export interface SlackManifest {
  display_information: {
    name: string;
    description: string;
  };
  features: {
    bot_user: {
      display_name: string;
      always_online: boolean;
    };
  };
  oauth_config: {
    scopes: {
      bot: string[];
    };
    redirect_urls?: string[];
  };
  settings: {
    socket_mode_enabled: boolean;
    event_subscriptions?: {
      bot_events: string[];
    };
  };
}

export interface SlackAppResult {
  appId: string;
  clientId: string;
  clientSecret: string;
  botToken?: string;
}

export interface SlackOAuthResult {
  botToken: string;
  teamId: string;
  teamName: string;
}

interface SlackManifestCreateResponse {
  ok: boolean;
  app_id?: string;
  credentials?: {
    client_id: string;
    client_secret: string;
    verification_token: string;
    signing_secret: string;
  };
  oauth_authorize_url?: string;
  error?: string;
}

interface SlackOAuthAccessResponse {
  ok: boolean;
  access_token?: string;
  team?: { id: string; name: string };
  error?: string;
}

// ── Bot scopes needed for a typical agent app ──

const BOT_SCOPES = [
  "chat:write",
  "channels:read",
  "im:read",
  "im:write",
  "im:history",
  "users:read",
];

const BOT_EVENTS = ["message.im", "message.channels"];

// ── Build Manifest ──

export function buildSlackManifest(
  agentName: string,
  agentDescription: string,
): SlackManifest {
  const displayName =
    agentName.length > 35 ? agentName.slice(0, 35) : agentName;

  return {
    display_information: {
      name: agentName,
      description: agentDescription || `${agentName} — powered by AgentDial`,
    },
    features: {
      bot_user: {
        display_name: displayName,
        always_online: true,
      },
    },
    oauth_config: {
      scopes: {
        bot: BOT_SCOPES,
      },
    },
    settings: {
      socket_mode_enabled: true,
      event_subscriptions: {
        bot_events: BOT_EVENTS,
      },
    },
  };
}

// ── Create App via Manifest API ──

export async function createSlackApp(
  configToken: string,
  manifest: SlackManifest,
): Promise<SlackAppResult> {
  const res = await fetch("https://slack.com/api/apps.manifest.create", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${configToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ manifest }),
  });

  if (!res.ok) {
    throw new Error(`Slack API HTTP ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as SlackManifestCreateResponse;
  if (!data.ok || !data.credentials) {
    throw new Error(
      `Slack manifest create failed: ${data.error ?? "unknown error"}`,
    );
  }

  return {
    appId: data.app_id ?? "",
    clientId: data.credentials.client_id,
    clientSecret: data.credentials.client_secret,
  };
}

// ── Exchange OAuth Code for Bot Token ──

export async function exchangeSlackCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<SlackOAuthResult> {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    throw new Error(`Slack OAuth HTTP ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as SlackOAuthAccessResponse;
  if (!data.ok || !data.access_token) {
    throw new Error(
      `Slack OAuth exchange failed: ${data.error ?? "unknown error"}`,
    );
  }

  return {
    botToken: data.access_token,
    teamId: data.team?.id ?? "",
    teamName: data.team?.name ?? "Unknown",
  };
}
