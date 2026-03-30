# AgentDial TODO — v2.0 Roadmap

**Last updated:** 2026-03-30
**Current version:** 1.2.0 (npm published)
**Target:** Universal Agent Identity Protocol — "Clerk/Stripe/Plaid for Agent Identity"
**Codebase:** ~7K LOC, 9 adapters, 10 commands, 4 test suites

---

## P0: Critical Bugs & Blockers (Ship-Stopping)

### Webhook Handling

- [ ] P0-001: Voice calls return JSON instead of TwiML `<Gather>`+`<Say>` XML (serve.ts:208)
- [ ] P0-002: Webhook handler bypasses adapter `handleWebhook()` methods — VoiceAdapter never called
- [ ] P0-003: Telegram webhook response must include `method: "sendMessage"` + `chat_id` (partially fixed)
- [ ] P0-004: WhatsApp sandbox messages need `whatsapp:` prefix on From/To numbers in normalizeMessage()
- [ ] P0-005: Slack webhook endpoint needs `url_verification` challenge response for Event Subscriptions mode

### Gateway Server

- [ ] P0-006: No graceful shutdown — open WebSocket connections (Discord/Slack) leak on SIGTERM
- [ ] P0-007: serve.ts exceeds 550 lines — split into `serve-http.ts`, `serve-ws.ts`, `serve-webhooks.ts`
- [ ] P0-008: No request logging — add structured JSON logs for all inbound/outbound messages
- [ ] P0-009: Unhandled promise rejections in WebSocket adapter `connect()` crash the server
- [ ] P0-010: Built-in agent echo mode doesn't handle empty message text (crashes on attachment-only msgs)

### Build & Tests

- [ ] P0-011: `discord.js` listed as peerDependency but not installed — serve.ts import fails at runtime
- [ ] P0-012: No integration tests — only mocked unit tests exist (4 suites, 977 lines)
- [ ] P0-013: CHANGELOG.md only has v1.0.0 — missing v1.1.0, v1.1.1, v1.2.0 entries
- [ ] P0-014: `npm pack --dry-run` includes test files — add `__tests__/` to .npmignore
- [ ] P0-015: No .eslintrc or .prettierrc — code style inconsistencies across files

---

## P1: E2E All 7 Channels (Prove It Works)

### Telegram (Status: VERIFIED)

- [x] P1-001: Bot token saved to `~/.agentdial/credentials/telegram.json`
- [x] P1-002: Webhook registration via Bot API `setWebhook`
- [x] P1-003: Send message in Telegram Web -> bot responds
- [x] P1-004: Screenshot evidence captured
- [ ] P1-005: Test inline keyboard responses (cards with actions)
- [ ] P1-006: Test file/image attachment forwarding
- [ ] P1-007: Test group chat mention detection (@bot_name)
- [ ] P1-008: Test long message splitting (>4096 chars)

### Discord (Status: IN PROGRESS)

- [ ] P1-009: Create "AgentDial Test" application in Discord Dev Portal
- [ ] P1-010: Generate bot token + enable MESSAGE CONTENT intent
- [ ] P1-011: Save `bot_token` + `application_id` to `~/.agentdial/credentials/discord.json`
- [ ] P1-012: Generate OAuth2 invite URL with `bot` scope + `Send Messages` permission
- [ ] P1-013: Invite bot to test server
- [ ] P1-014: `agentdial serve` auto-connects Discord WebSocket adapter
- [ ] P1-015: Send message in Discord -> bot responds
- [ ] P1-016: Screenshot evidence
- [ ] P1-017: Test embed formatting (cards -> Discord embeds)
- [ ] P1-018: Test message length truncation (>2000 chars)
- [ ] P1-019: Test attachment handling (images, files)
- [ ] P1-020: Test DM vs server channel routing

### Slack (Status: NOT STARTED)

- [ ] P1-021: Create Slack app via manifest API (`slack-manifest.ts`)
- [ ] P1-022: Complete OAuth flow — install to test workspace
- [ ] P1-023: Save `bot_token` (xoxb-) + `app_token` (xapp-) to credentials
- [ ] P1-024: Socket Mode connection via `@slack/socket-mode`
- [ ] P1-025: Send DM to bot -> bot responds
- [ ] P1-026: Screenshot evidence
- [ ] P1-027: Test Block Kit formatting (cards -> Slack blocks)
- [ ] P1-028: Test slash command responses
- [ ] P1-029: Test thread replies (threadId mapping)
- [ ] P1-030: Test channel mention vs DM routing
- [ ] P1-031: Test app home tab rendering

### SMS via Twilio (Status: NOT STARTED)

- [ ] P1-032: Validate Twilio Account SID + Auth Token
- [ ] P1-033: Auto-buy or use existing phone number (+1 866 834 2357)
- [ ] P1-034: Configure SMS webhook URL via Twilio API
- [ ] P1-035: `agentdial serve --tunnel` registers webhook automatically
- [ ] P1-036: Send SMS to Twilio number -> bot responds via SMS
- [ ] P1-037: Screenshot evidence
- [ ] P1-038: Test Twilio signature validation (HMAC-SHA1)
- [ ] P1-039: Test long SMS splitting (>160 chars -> multipart)
- [ ] P1-040: Test MMS image attachment handling
- [ ] P1-041: Test opt-out handling (STOP/HELP keywords)

### WhatsApp via Twilio (Status: NOT STARTED)

- [ ] P1-042: Join Twilio WhatsApp Sandbox (send join code)
- [ ] P1-043: Configure WhatsApp webhook URL
- [ ] P1-044: Send WhatsApp message -> bot responds
- [ ] P1-045: Screenshot evidence
- [ ] P1-046: Test `whatsapp:` prefix handling on phone numbers
- [ ] P1-047: Test media message handling (images, voice notes)
- [ ] P1-048: Test template message support for outbound
- [ ] P1-049: Document path to production WhatsApp (Meta Business verification)

### Voice via Twilio (Status: NOT STARTED)

- [ ] P1-050: Configure voice webhook URL returning TwiML
- [ ] P1-051: Implement `<Gather>` + `<Say>` TwiML response cycle
- [ ] P1-052: Call Twilio number -> speak -> agent responds via TTS
- [ ] P1-053: Screenshot/recording evidence
- [ ] P1-054: Test call transcription logging
- [ ] P1-055: Test multi-turn voice conversation (Gather loop)
- [ ] P1-056: Test call transfer/hangup actions
- [ ] P1-057: Test voicemail detection and recording

### Email via SendGrid (Status: NOT STARTED)

- [ ] P1-058: Configure SendGrid API key + verified sender
- [ ] P1-059: Set up SendGrid Inbound Parse webhook
- [ ] P1-060: Send email to agent address -> bot responds via email
- [ ] P1-061: Screenshot evidence
- [ ] P1-062: Test HTML email rendering (cards -> HTML)
- [ ] P1-063: Test attachment forwarding
- [ ] P1-064: Test reply threading (In-Reply-To header)
- [ ] P1-065: Test subject line extraction as conversation topic

---

## P2: Recipe System & Developer Experience

### Recipe Framework

- [ ] P2-001: Define `Recipe` interface with Zod validation (`src/recipes/types.ts` — exists, enhance)
- [ ] P2-002: Add `frictionTier` field (0=zero-click, 1=token paste, 2=OAuth click, 3=account setup, 4=verification)
- [ ] P2-003: Add `cost` field (`{ setup, monthly, perMessage }`) to each recipe
- [ ] P2-004: Add `prerequisites` array with check functions
- [ ] P2-005: Add `troubleshooting` entries per recipe (common errors + fixes)
- [ ] P2-006: Implement recipe runner with step-by-step progress UI
- [ ] P2-007: Implement `recipe_verify` — E2E verification per channel

### Per-Channel Recipes (enhance existing 9 files in `src/recipes/`)

- [ ] P2-008: `telegram.ts` — add BotFather command sequence, webhook auto-registration
- [ ] P2-009: `discord.ts` — add Dev Portal walkthrough, intent checklist, invite URL generator
- [ ] P2-010: `slack.ts` — add manifest API auto-creation, OAuth flow, Socket Mode setup
- [ ] P2-011: `twilio-sms.ts` — add account validation, number search/buy, webhook config
- [ ] P2-012: `twilio-whatsapp.ts` — add sandbox join flow, production verification guide
- [ ] P2-013: `voice.ts` — add TwiML configuration, multi-provider selection
- [ ] P2-014: `email.ts` — add SendGrid setup, domain verification, inbound parse config

### New Recipes (Voice Providers)

- [ ] P2-015: `voice-vapi.ts` — VAPI API key + assistant creation + phone number provisioning
- [ ] P2-016: `voice-elevenlabs.ts` — ElevenLabs Conversational AI 2.0 setup + voice ID config
- [ ] P2-017: `voice-openai.ts` — OpenAI Realtime API WebSocket setup
- [ ] P2-018: `voice-livekit.ts` — LiveKit Agents OSS self-hosted setup
- [ ] P2-019: `voice-bland.ts` — Bland.ai API setup (100 free calls/day)

### New Recipes (Email Providers)

- [ ] P2-020: `email-agentmail.ts` — AgentMail 1-API-call setup (friction tier 0)
- [ ] P2-021: `email-cloudflare.ts` — Cloudflare Email Workers free setup
- [ ] P2-022: `email-mailgun.ts` — Mailgun programmatic subaccounts (1000 free/mo)

### New Recipes (Experimental Channels)

- [ ] P2-023: `imessage-sendblue.ts` — SendBlue API for iMessage + RCS + SMS fallback chain
- [ ] P2-024: `teams.ts` — Microsoft Teams bot registration + adapter
- [ ] P2-025: `messenger.ts` — Facebook Messenger Page bot + webhook
- [ ] P2-026: `web-widget.ts` — Embeddable web chat widget (WebSocket)

### CLI Commands

- [ ] P2-027: `agentdial recipes` — list all recipes with friction tiers, costs, status
- [ ] P2-028: `agentdial recipes run <channel>` — execute recipe interactively
- [ ] P2-029: `agentdial recipes verify <channel>` — verify E2E for specific channel
- [ ] P2-030: `agentdial recipes verify --all` — verify all configured channels
- [ ] P2-031: `agentdial quickstart` — creates identity + sets up top 3 free channels (Telegram, Discord, Slack)

### MCP Tools (mcp-serve.ts)

- [ ] P2-032: `recipe_list` tool — list available recipes with metadata
- [ ] P2-033: `recipe_run` tool — execute recipe step by step
- [ ] P2-034: `recipe_verify` tool — verify channel E2E
- [ ] P2-035: `recipe_status` tool — show which recipes complete vs pending
- [ ] P2-036: `channel_logs` tool — stream recent message logs for a channel
- [ ] P2-037: `identity_update` tool — modify IDENTITY.md fields programmatically

---

## P3: OAuth Platform Layer & Managed Services

### Auth Layer (Clerk Integration)

- [ ] P3-001: `agentdial login` → Clerk OAuth device flow → JWT in `~/.agentdial/auth.json`
- [ ] P3-002: `agentdial logout` → clear local auth state
- [ ] P3-003: `agentdial whoami` → show authenticated user info
- [ ] P3-004: JWT refresh logic with expiry handling
- [ ] P3-005: Auth middleware for managed API calls
- [ ] P3-006: Rate limit auth requests (prevent abuse)

### Managed Sub-Accounts

- [ ] P3-007: Twilio sub-account creation per authenticated user
- [ ] P3-008: Auto-provision phone number on sub-account
- [ ] P3-009: Auto-configure webhook URLs on provisioned numbers
- [ ] P3-010: SendGrid subuser creation (Pro plan required)
- [ ] P3-011: AgentMail inbox creation per user (1 API call)
- [ ] P3-012: Managed credential storage (encrypted, server-side)
- [ ] P3-013: Sub-account usage tracking + billing integration
- [ ] P3-014: Sub-account teardown on user deletion

### Token Delegation

- [ ] P3-015: Discord OAuth2 bot invite flow (1-click for end users)
- [ ] P3-016: Slack OAuth install flow (manifest API + 1-click)
- [ ] P3-017: Telegram token paste + validation (no OAuth available)
- [ ] P3-018: Encrypted token storage via Supabase (replace local JSON)
- [ ] P3-019: Token rotation alerts (expiry monitoring)

### Auto-Provisioning on Signup

- [ ] P3-020: Zero-friction email via AgentMail on account creation
- [ ] P3-021: Auto phone number via Twilio sub-account (paid plan)
- [ ] P3-022: Guided Telegram setup (3-step BotFather guide)
- [ ] P3-023: 1-click Slack app creation + OAuth install
- [ ] P3-024: 1-click Discord bot invite via OAuth URL
- [ ] P3-025: Channel priority queue (easiest first, paid last)

### Web Dashboard (`/agentdial/dashboard`)

- [ ] P3-026: Channel configuration cards (enable/disable per channel)
- [ ] P3-027: Real-time connection status indicators (green/red per channel)
- [ ] P3-028: WebSocket live status updates from gateway
- [ ] P3-029: Message log viewer with search + filter
- [ ] P3-030: Analytics dashboard (messages/day, response time, channel breakdown)
- [ ] P3-031: Identity editor (IDENTITY.md YAML + Markdown preview)
- [ ] P3-032: Credential management UI (add/rotate/revoke tokens)
- [ ] P3-033: Recipe runner UI (step-by-step with progress indicators)
- [ ] P3-034: Agent configuration panel (provider, model, system prompt)
- [ ] P3-035: Webhook URL display + copy button per channel
- [ ] P3-036: Test message sender (pick channel, type message, see response)
- [ ] P3-037: Mobile-responsive layout (agents are managed from phones too)

---

## P4: Voice Pipeline (Multi-Provider)

### VAPI Integration (Primary — Easiest)

- [ ] P4-001: `voice-vapi.ts` adapter — full implementation
- [ ] P4-002: VAPI assistant creation from IDENTITY.md personality
- [ ] P4-003: Phone number provisioning (free 10 US numbers)
- [ ] P4-004: Inbound call handling → VAPI → Claude → voice response
- [ ] P4-005: Outbound call initiation via CLI (`agentdial call <number>`)
- [ ] P4-006: Call recording + transcription storage
- [ ] P4-007: VAPI webhook integration for call events
- [ ] P4-008: Voice selection per agent identity

### ElevenLabs Conversational AI 2.0

- [ ] P4-009: `voice-elevenlabs.ts` adapter — full implementation
- [ ] P4-010: Voice cloning integration (custom agent voice)
- [ ] P4-011: Multilingual auto-detection
- [ ] P4-012: Emotion/tone configuration from IDENTITY.md
- [ ] P4-013: Streaming response for low-latency conversations
- [ ] P4-014: Voice ID management (create, list, select)

### OpenAI Realtime API

- [ ] P4-015: `voice-openai-realtime.ts` adapter — WebSocket implementation
- [ ] P4-016: Speech-to-speech pipeline (no STT/TTS intermediary)
- [ ] P4-017: Function calling during voice conversations
- [ ] P4-018: Interruption handling (user speaks mid-response)
- [ ] P4-019: Audio format negotiation (opus, pcm16, g711)
- [ ] P4-020: Session management (turn detection, VAD)

### LiveKit Agents (OSS Option)

- [ ] P4-021: `voice-livekit.ts` adapter — WebRTC implementation
- [ ] P4-022: Self-hosted deployment guide
- [ ] P4-023: Room management for multi-party calls
- [ ] P4-024: Screen sharing support for agent demos

### Voice Infrastructure

- [ ] P4-025: Voice provider abstraction layer (swap providers via config)
- [ ] P4-026: Fallback chain: VAPI -> ElevenLabs -> OpenAI Realtime -> Twilio TTS
- [ ] P4-027: Call analytics (duration, cost, transcription quality)
- [ ] P4-028: Voice activity detection tuning per provider
- [ ] P4-029: DTMF tone handling for IVR-style flows
- [ ] P4-030: Conference/transfer capabilities

---

## P5: Distribution, Polish & v2.0 Release

### npm v2.0.0 Release

- [ ] P5-001: Semver bump to 2.0.0 with breaking change documentation
- [ ] P5-002: Update README with one-click setup instructions + GIF demos
- [ ] P5-003: Add `agentdial quickstart` command to README quick start
- [ ] P5-004: Add `engines.node` >= 20 (drop Node 18 for ESM compat)
- [ ] P5-005: Optimize `npm pack` tarball — exclude tests, docs, examples
- [ ] P5-006: Add `postinstall` script that prints setup instructions
- [ ] P5-007: Publish with provenance (`npm publish --provenance`)
- [ ] P5-008: Add npm badges (version, downloads, license, node version)
- [ ] P5-009: Cross-link to related Energy tools (agentbench, agentgrid)
- [ ] P5-010: Create npm org scope `@energy/agentdial` for future packages

### CI/CD Pipeline

- [ ] P5-011: GitHub Actions: test matrix (Node 18, 20, 22 x ubuntu, macOS)
- [ ] P5-012: Auto-publish to npm on semver tag push (v*.*.\*)
- [ ] P5-013: PR checks: `tsc --noEmit` + `vitest run` + `npm pack --dry-run`
- [ ] P5-014: Dependabot for dependency updates
- [ ] P5-015: CodeQL security scanning
- [ ] P5-016: Coverage reporting via Coveralls/Codecov
- [ ] P5-017: E2E integration test suite (mock servers for each platform)
- [ ] P5-018: Release notes auto-generation from conventional commits
- [ ] P5-019: npm audit in CI (fail on high/critical)
- [ ] P5-020: Bundle size tracking per release

### Documentation Site

- [ ] P5-021: Docusaurus/Starlight site at `docs.agentdial.dev`
- [ ] P5-022: Getting Started guide (5-minute setup)
- [ ] P5-023: Per-platform setup guides (7 channels x detailed walkthrough)
- [ ] P5-024: Architecture overview (gateway, adapters, identity, credentials)
- [ ] P5-025: API reference for GatewayMessage / GatewayResponse schemas
- [ ] P5-026: PROTOCOL.md v2 spec with OAuth layer additions
- [ ] P5-027: Recipe catalog with friction tiers + cost comparison table
- [ ] P5-028: Built-in agent configuration guide
- [ ] P5-029: MCP integration guide for Claude Code
- [ ] P5-030: Troubleshooting guide (common errors per platform)
- [ ] P5-031: Migration guide (v1.x -> v2.0)
- [ ] P5-032: Video tutorials (setup, first message, voice call)
- [ ] P5-033: OpenAPI spec for gateway HTTP endpoints
- [ ] P5-034: Webhook payload examples per channel

### Security Audit

- [ ] P5-035: Credential file permissions audit (all 0600, directory 0700)
- [ ] P5-036: Webhook signature validation coverage (all inbound channels)
- [ ] P5-037: Input sanitization on all `normalizeMessage()` paths
- [ ] P5-038: No secrets in logs — redact tokens in structured logging
- [ ] P5-039: CORS policy on gateway server (restrict origins)
- [ ] P5-040: Helmet-style HTTP headers on gateway responses
- [ ] P5-041: Rate limiting on gateway endpoints (per-IP, per-channel)
- [ ] P5-042: Max payload size enforcement (already 1MB, verify all paths)
- [ ] P5-043: Dependency audit — check for known vulnerabilities
- [ ] P5-044: Token encryption at rest (AES-256 for credential files)
- [ ] P5-045: Audit `built-in-agent.ts` for prompt injection vectors
- [ ] P5-046: Verify no PII leakage in error messages
- [ ] P5-047: Add CSP headers if serving any HTML (dashboard)
- [ ] P5-048: mcp-serve.ts tool permission boundaries (principle of least privilege)

### Rate Limiting & Reliability

- [ ] P5-049: Per-channel rate limiting (respect platform limits)
- [ ] P5-050: Telegram: 30 msg/sec global, 1 msg/sec per chat
- [ ] P5-051: Discord: 5 msg/5sec per channel
- [ ] P5-052: Slack: 1 msg/sec per channel (Web API tier)
- [ ] P5-053: Twilio: 1 msg/sec per number (SMS), higher for short codes
- [ ] P5-054: Exponential backoff with jitter on 429 responses
- [ ] P5-055: Circuit breaker pattern for failing channels
- [ ] P5-056: Dead letter queue for failed message deliveries
- [ ] P5-057: Health check endpoint enhancement (per-channel health)
- [ ] P5-058: Automatic reconnection for WebSocket adapters (Discord, Slack)

### Conversation Persistence

- [ ] P5-059: Define conversation storage interface (`ConversationStore`)
- [ ] P5-060: In-memory store (default, for development)
- [ ] P5-061: SQLite store (`~/.agentdial/conversations.db`)
- [ ] P5-062: Supabase store (for managed/cloud deployments)
- [ ] P5-063: Conversation ID tracking across channels (same user, diff channels)
- [ ] P5-064: Message history injection into agent context
- [ ] P5-065: Conversation export (JSON, CSV)
- [ ] P5-066: TTL-based conversation expiry (configurable retention)
- [ ] P5-067: Cross-channel conversation threading (Discord msg -> SMS reply)
- [ ] P5-068: Conversation search (full-text across all channels)

### Multi-Agent Routing

- [ ] P5-069: Define `AgentRouter` interface (message -> agent selection)
- [ ] P5-070: Channel-based routing (different agent per channel)
- [ ] P5-071: Intent-based routing (classify message -> route to specialist agent)
- [ ] P5-072: Keyword-based routing (regex patterns -> agent mapping)
- [ ] P5-073: Fallback chain (primary agent -> fallback agent on error)
- [ ] P5-074: Load balancing across multiple agent instances
- [ ] P5-075: Agent handoff protocol (transfer conversation between agents)
- [ ] P5-076: Routing rules configuration in `~/.agentdial/routing.json`
- [ ] P5-077: A/B testing support (percentage-based agent routing)
- [ ] P5-078: Agent health monitoring (response time, error rate)

### Named Tunnels & Custom Domains

- [ ] P5-079: Cloudflare Tunnel named tunnel support (`agentdial serve --tunnel-name mybot`)
- [ ] P5-080: Persistent tunnel URLs (survive restarts)
- [ ] P5-081: Custom domain mapping (`bot.mycompany.com` -> gateway)
- [ ] P5-082: Auto-TLS via Cloudflare or Let's Encrypt
- [ ] P5-083: Tunnel health monitoring + auto-reconnect
- [ ] P5-084: Multi-tunnel support (separate URL per channel webhook)
- [ ] P5-085: Tunnel URL saved to config for webhook re-registration on restart

### iMessage via SendBlue

- [ ] P5-086: `imessage.ts` adapter implementation
- [ ] P5-087: SendBlue API integration (send/receive iMessage)
- [ ] P5-088: Smart fallback chain: iMessage -> RCS -> SMS
- [ ] P5-089: Delivery receipt tracking
- [ ] P5-090: Group iMessage support
- [ ] P5-091: Tapback reaction handling
- [ ] P5-092: Rich link preview support
- [ ] P5-093: Recipe for SendBlue account setup

---

## Backlog: Future Channels & Integrations

### New Channel Adapters

- [ ] BL-001: Microsoft Teams adapter (Bot Framework SDK)
- [ ] BL-002: Facebook Messenger adapter (Page webhook)
- [ ] BL-003: Instagram DM adapter (Graph API)
- [ ] BL-004: Line adapter (Messaging API)
- [ ] BL-005: WeChat adapter (Official Account API)
- [ ] BL-006: Viber adapter (Bot API)
- [ ] BL-007: Matrix/Element adapter (open protocol)
- [ ] BL-008: Signal adapter (signal-cli bridge)
- [ ] BL-009: Reddit adapter (bot account + API)
- [ ] BL-010: Twitter/X DM adapter (API v2)
- [ ] BL-011: Web widget adapter (embeddable chat, WebSocket)
- [ ] BL-012: Webex adapter (Bot Framework)

### Agent Capabilities

- [ ] BL-013: Tool use forwarding (agent tool calls -> platform-specific rendering)
- [ ] BL-014: Streaming responses (token-by-token for supported channels)
- [ ] BL-015: Multi-modal input (images -> vision API, voice -> STT)
- [ ] BL-016: Multi-modal output (generate images, voice, files per channel)
- [ ] BL-017: Scheduled messages (agent can schedule future sends)
- [ ] BL-018: Proactive messaging (agent initiates conversations)
- [ ] BL-019: Typing indicators (show "typing..." on supported platforms)
- [ ] BL-020: Read receipts forwarding
- [ ] BL-021: Rich card builder API (create cards programmatically)
- [ ] BL-022: Action button handling (user clicks card button -> callback)

### Platform Features

- [ ] BL-023: Webhook retry logic (platform retries on 5xx)
- [ ] BL-024: Idempotency keys (prevent duplicate message processing)
- [ ] BL-025: Message deduplication (same message from multiple sources)
- [ ] BL-026: Platform-specific feature flags (enable/disable per channel)
- [ ] BL-027: Channel capability matrix (what each channel supports)
- [ ] BL-028: Graceful degradation (rich -> plain text for limited channels)

### Developer Experience

- [ ] BL-029: `agentdial dev` — hot-reload gateway on file changes
- [ ] BL-030: `agentdial mock <channel>` — simulate inbound messages without real platform
- [ ] BL-031: `agentdial replay <message-id>` — replay a message through the pipeline
- [ ] BL-032: `agentdial inspect` — show full message transformation pipeline
- [ ] BL-033: Plugin system for custom adapters (`agentdial plugin install <npm-package>`)
- [ ] BL-034: Webhook debugger UI (inspect raw payloads + transformed messages)
- [ ] BL-035: OpenTelemetry tracing integration
- [ ] BL-036: Prometheus metrics endpoint (`/metrics`)

### Infrastructure

- [ ] BL-037: Docker image (`ghcr.io/energy/agentdial`)
- [ ] BL-038: Docker Compose with gateway + SQLite + tunnel
- [ ] BL-039: Kubernetes Helm chart
- [ ] BL-040: Vercel Edge deployment (serverless gateway)
- [ ] BL-041: Fly.io deployment template (persistent WebSocket)
- [ ] BL-042: Railway one-click deploy button

---

## Metrics & Success Criteria

### P0 Complete When:

- 0 TypeScript errors (`tsc --noEmit`)
- All 46+ existing tests pass (`vitest run`)
- `npm pack --dry-run` produces clean tarball
- Gateway server starts without crashes

### P1 Complete When:

- All 7 channels receive a message and respond
- Screenshot evidence for each channel
- `agentdial serve --tunnel` auto-registers all webhooks
- Each channel has at least 1 E2E test

### P2 Complete When:

- 12+ recipes with friction tiers and verification
- `agentdial recipes` CLI command works
- MCP tools for recipe management
- `agentdial quickstart` sets up 3 channels in <5 minutes

### P3 Complete When:

- `agentdial login` authenticates via Clerk
- Managed Twilio sub-account creation works
- Web dashboard shows live channel status
- Auto-email via AgentMail on signup

### P4 Complete When:

- VAPI: call number -> agent responds via voice
- ElevenLabs: custom voice ID working
- OpenAI Realtime: speech-to-speech working
- Voice provider switchable via config

### P5 Complete When:

- npm v2.0.0 published with provenance
- CI/CD auto-publishes on tag
- Docs site live at docs.agentdial.dev
- Security audit passed (0 high/critical)
- Conversation persistence with SQLite default
- Multi-agent routing with channel-based rules
- Named tunnels with persistent URLs

---

## Item Count

| Phase               | Items   | Status      |
| ------------------- | ------- | ----------- |
| P0: Critical Bugs   | 15      | In Progress |
| P1: E2E Channels    | 50      | In Progress |
| P2: Recipes & DX    | 37      | Not Started |
| P3: OAuth & Managed | 37      | Not Started |
| P4: Voice Pipeline  | 30      | Not Started |
| P5: Distribution    | 93      | Not Started |
| Backlog             | 42      | Future      |
| **Total**           | **304** |             |
