# Agent Identity Protocol (AIP) — Specification v1.0

## Abstract

The Agent Identity Protocol (AIP) defines a standard for declaring and managing AI agent identity across communication platforms. AIP consists of two primitives: `IDENTITY.md` (a declarative identity file) and `GatewayMessage` (a normalized message format). Together, they enable any AI agent to be reachable on any channel through a single configuration.

## Status

Draft — March 2026

## 1. IDENTITY.md

An `IDENTITY.md` file declares an agent's identity. It uses YAML frontmatter for machine-readable configuration and Markdown body for human-readable context.

### 1.1 Required Fields

```yaml
---
name: string # Agent name (unique within deployment)
version: string # Semver version of this identity
---
```

### 1.2 Optional Fields

```yaml
---
tagline: string # One-line description
agent_url: string # HTTP endpoint that receives GatewayMessages

channels:
  <channel_type>:
    enabled: boolean
    handle: string # Platform-specific identifier
    webhook: string # Inbound webhook URL

gateway:
  port: number # Gateway server port (default: 3141)
  format: string # Protocol version (default: "aip-v1")
---
```

### 1.3 Channel Types

The following channel types are defined in AIP v1.0:

| Type        | Platform           | Identifier Format                |
| ----------- | ------------------ | -------------------------------- |
| `telegram`  | Telegram Bot API   | Bot username                     |
| `discord`   | Discord Bot        | Bot ID or username#discriminator |
| `slack`     | Slack App          | Workspace/channel                |
| `sms`       | SMS via Twilio     | E.164 phone number               |
| `whatsapp`  | WhatsApp Business  | E.164 phone number               |
| `email`     | Email via SendGrid | Email address                    |
| `voice`     | Voice via Twilio   | E.164 phone number               |
| `teams`     | Microsoft Teams    | App ID                           |
| `messenger` | Meta Messenger     | Page ID                          |
| `web`       | Web widget         | URL                              |

### 1.4 Markdown Body

The Markdown body after the frontmatter is free-form. It is intended as a system prompt or personality description. Implementations MAY use it to inform agent behavior.

## 2. GatewayMessage

A `GatewayMessage` is the normalized representation of an incoming message from any channel.

### 2.1 Schema

```typescript
interface GatewayMessage {
  id: string; // Unique message ID (native or generated)
  channel: ChannelType; // Source channel
  from: string; // Sender identifier
  text: string; // Message text content
  timestamp: number; // Unix timestamp (seconds)
  threadId?: string; // Thread/conversation ID
  replyTo?: string; // ID of message being replied to
  attachments?: Attachment[];
  metadata?: Record<string, unknown>;
}

interface Attachment {
  type: "image" | "audio" | "video" | "file";
  url: string;
  name?: string;
  mimeType?: string;
}
```

### 2.2 Normalization Rules

1. `id` SHOULD be the native message ID from the platform when available. Implementations MAY generate a UUID if the platform does not provide one.
2. `from` MUST be the platform-specific sender identifier (phone number for SMS, username for Telegram, user ID for Discord).
3. `text` MUST be plain text. Rich formatting is stripped during normalization.
4. `timestamp` MUST be Unix epoch in seconds.
5. `metadata` MAY contain platform-specific fields not covered by the schema.

## 3. GatewayResponse

A `GatewayResponse` is what the agent backend returns.

### 3.1 Schema

```typescript
interface GatewayResponse {
  text: string; // Plain text response
  cards?: RichCard[]; // Structured content
  actions?: Action[]; // Interactive elements
  metadata?: Record<string, unknown>;
}

interface RichCard {
  title: string;
  description?: string;
  imageUrl?: string;
  actions?: Action[];
}

interface Action {
  label: string;
  type: "url" | "callback" | "reply";
  value: string;
}
```

### 3.2 Channel-Specific Formatting

Implementations MUST format responses appropriately per channel:

| Channel  | Text               | Cards              | Actions           |
| -------- | ------------------ | ------------------ | ----------------- |
| Telegram | Markdown           | Inline text        | Inline keyboards  |
| Discord  | Embed              | Embed fields       | Components        |
| Slack    | mrkdwn             | Block Kit sections | Block Kit buttons |
| SMS      | Plain text         | Concatenated text  | N/A               |
| Email    | HTML               | HTML cards         | Links             |
| Voice    | Synthesized speech | N/A                | N/A               |

## 4. Gateway Server

An AIP gateway server receives incoming messages from all configured channels, normalizes them to `GatewayMessage`, forwards to the agent backend, and formats the `GatewayResponse` back to the originating channel.

### 4.1 Endpoints

| Method | Path                | Purpose                  |
| ------ | ------------------- | ------------------------ |
| POST   | `/webhook/:channel` | Channel-specific webhook |
| POST   | `/message`          | Direct GatewayMessage    |
| GET    | `/health`           | Health check             |

### 4.2 Webhook Validation

Implementations MUST validate webhook signatures:

- **Twilio:** HMAC-SHA1 via `X-Twilio-Signature`
- **Slack:** HMAC-SHA256 via `X-Slack-Signature` with timestamp replay protection
- **Telegram:** Secret token path validation

## 5. Credential Storage

Credentials MUST be stored separately from the identity file:

- Location: `~/.agentdial/credentials/<channel>.json`
- Permissions: `0600` (owner read/write only)
- Credentials MUST NOT be committed to version control

## 6. Reference Implementation

The reference implementation is `agentdial` (npm: `agentdial`, GitHub: `naman10parikh/agentdial`).

## License

This specification is released under the MIT License.
