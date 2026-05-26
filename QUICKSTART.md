# agentdial — Quickstart

## Use the CLI

```bash
npm i -g agentdial        # or: npx agentdial setup
agentdial setup           # interactive: wire your agent into channels
agentdial serve           # run the gateway (webhooks → GatewayMessage → your backend)
agentdial status          # show configured channels
```

Define your agent in `IDENTITY.md` (see `PROTOCOL.md` for the AIP v1.0 spec). Credentials are
stored in `~/.agentdial/credentials/<channel>.json` — never in this repo.

## Develop

```bash
pnpm install && pnpm build && pnpm test
node dist/index.js --help
```

## Where the harness lives

The agent-native harness formula (identity, memory, brain, skills, hooks, sub-agents, eval):
see `CLAUDE.md` → "Harness components".
