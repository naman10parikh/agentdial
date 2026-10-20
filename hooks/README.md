# hooks/

The Claude Code plugin's hooks. [`hooks.json`](hooks.json) wires one `PreToolUse` hook,
[`guard-credentials.cjs`](guard-credentials.cjs), which blocks any tool call that would read, copy or
print AgentDial's stored channel credentials (`~/.agentdial/credentials/`) or login session
(`~/.agentdial/auth.json`). The same hook runs for maintainers through `.claude/settings.json`,
beside the general safety hooks in `.claude/hooks/`.

Test it: `echo '{"tool_name":"Read","tool_input":{"file_path":"/x/.agentdial/auth.json"}}' | node hooks/guard-credentials.cjs`
prints a `deny` decision.
