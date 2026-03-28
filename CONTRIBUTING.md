# Contributing to agentdial

Thanks for your interest in contributing. Here is everything you need.

## Setup

```bash
git clone https://github.com/naman10parikh/agentdial.git
cd agentdial
pnpm install
pnpm build
```

## Adding a New Channel Adapter

All adapters live in `src/adapters/`. To add a new channel:

1. **Create the adapter file:** `src/adapters/{channel-name}.ts`

2. **Implement the `ChannelAdapter` interface:**

```typescript
import type {
  ChannelAdapter,
  ChannelConfig,
  ChannelStatus,
  GatewayMessage,
  GatewayResponse,
} from "./types.js";

export class MyChannelAdapter implements ChannelAdapter {
  readonly name = "mychannel" as const;
  readonly displayName = "My Channel";
  readonly free = true;
  readonly setupTime = "3 min";

  async setup(config: ChannelConfig): Promise<void> {
    /* ... */
  }
  async connect(): Promise<void> {
    /* ... */
  }
  async disconnect(): Promise<void> {
    /* ... */
  }
  async send(to: string, response: GatewayResponse): Promise<void> {
    /* ... */
  }
  onMessage(handler: (msg: GatewayMessage) => Promise<GatewayResponse>): void {
    /* ... */
  }
  async test(): Promise<{ ok: boolean; error?: string }> {
    /* ... */
  }
  async status(): Promise<ChannelStatus> {
    /* ... */
  }
}
```

3. **Register in `src/adapters/index.ts`:**

```typescript
import { MyChannelAdapter } from "./mychannel.js";

// Add to the adapters map
["mychannel", new MyChannelAdapter()],
```

4. **Add the channel type** to `ChannelTypeSchema` in `src/adapters/types.ts` and to `SUPPORTED_CHANNELS` in `src/lib/constants.ts`.

5. **Add display name and setup time** to `CHANNEL_DISPLAY_NAMES` and `CHANNEL_SETUP_TIMES` in `src/lib/constants.ts`.

6. **Write tests** in `src/__tests__/adapters.test.ts`.

7. **If the adapter needs a third-party SDK**, add it as an optional `peerDependency` in `package.json`.

## Running Tests

```bash
pnpm test          # Run once
pnpm test:watch    # Watch mode
```

Tests use vitest. All tests must use mocks -- no real API calls. Keep tests focused and fast.

## Code Style

- TypeScript strict mode, no `any`
- Named exports only (no `export default`)
- `const` over `let`, never `var`
- Files under 400 lines
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`

## Submitting a PR

1. Fork and create a feature branch
2. Make your changes
3. Run `pnpm build && pnpm test` -- both must pass
4. Run `npm pack --dry-run` to verify the package is clean
5. Submit PR with a description of what changed and why

## Project Structure

```
src/
├── index.ts              # CLI entry point (commander)
├── adapters/
│   ├── types.ts          # Zod schemas + interfaces
│   ├── index.ts          # Adapter registry
│   ├── telegram.ts       # Telegram Bot API adapter
│   ├── discord.ts        # Discord.js adapter
│   ├── slack.ts          # Slack Socket Mode adapter
│   ├── twilio-sms.ts     # Twilio SMS adapter
│   ├── twilio-whatsapp.ts# Twilio WhatsApp adapter
│   └── email.ts          # SendGrid email adapter
├── commands/             # CLI command handlers
├── lib/
│   ├── config.ts         # Config load/save (~/.agentdial/config.json)
│   ├── constants.ts      # Version, paths, channel metadata
│   ├── credentials.ts    # Secure credential storage
│   ├── gateway.ts        # Message normalization + routing
│   ├── identity.ts       # IDENTITY.md parser/writer
│   └── ui.ts             # Terminal UI (chalk, tables, boxes)
├── __tests__/            # Vitest test suites
└── templates/            # IDENTITY.md template
```
