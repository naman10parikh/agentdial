---
name: give-agent-identity
description: Give an AI agent one identity and make it reachable on Telegram, Discord, Slack, SMS, WhatsApp, email or voice with AgentDial. Use when someone says "let people message my agent", "give my agent a phone number or a Telegram bot", or "put my agent on Slack", and the agent already answers over HTTP.
---

# Skill: give-agent-identity

## When to use it

The user has an agent that answers HTTP requests (or wants AgentDial's built-in test agent) and wants
people to reach it on a messaging channel. One `IDENTITY.md` declares who the agent is; AgentDial's
gateway carries every channel to the agent in one message format.

## Steps

1. **Run AgentDial** without installing it. Every command below works the same with `agentdial`
   after `npm i -g agentdial`.
   ```bash
   npx -y -p github:naman10parikh/agentdial agentdial --help
   ```
2. **Write the identity.** Create `IDENTITY.md` in the project. The frontmatter needs `name` and
   `version`; add `tagline`, `agent_url` (the agent's HTTP endpoint) and the channels to turn on. The
   body is the agent's personality, capabilities and boundaries, and doubles as its system prompt.
   ```yaml
   ---
   name: spark
   version: "1.0.0"
   tagline: Your AI concierge
   agent_url: http://localhost:8080/agent
   channels:
     telegram:
       enabled: true
   ---
   ```
3. **Start with a free channel.** Telegram needs one token from @BotFather and no payment details.
   Discord and Slack are also free. SMS, WhatsApp and voice need a Twilio account and cost cents per
   message or minute.
   ```bash
   agentdial setup --file ./IDENTITY.md
   agentdial channels add telegram      # asks for the bot token and stores it outside the project
   agentdial recipes run telegram       # guided setup with a check at the end
   ```
4. **Run the gateway.** Platforms need a public HTTPS address for webhooks; `--tunnel` opens one.
   ```bash
   agentdial serve --agent-url http://localhost:8080/agent --tunnel
   ```
   The agent receives one JSON shape for every channel, a `GatewayMessage`
   (`{ id, channel, from, text, timestamp }`), and replies with `{ "text": "..." }`.
5. **Prove it works.** `agentdial test -c telegram -m "hello"` sends a message through the pipeline.
   Then send a real message from a phone. A channel counts as reachable only after a real round trip.
6. **Report reachability honestly.** `agentdial status --json` lists every channel. Mark each one as
   declared, configured, tested or reachable.

## Output

An `IDENTITY.md` in the project, the channels that were configured, and a table with one row per
channel (declared, configured, tested, reachable), plus the next step for any channel that is not
reachable yet.

## Boundaries

- Never paste a token into `IDENTITY.md`, a prompt or a commit. AgentDial stores credentials in
  `~/.agentdial/credentials/` with owner-only permissions, and its plugin hook blocks reading them.
- Never turn off webhook signature checks to make a channel "work".
- Paid channels (SMS, WhatsApp, voice, some email) need the user's consent before setup.
