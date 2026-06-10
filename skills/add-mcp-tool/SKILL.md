---
name: add-mcp-tool
description: Expose a new agentdial capability to Claude Code (and any MCP client) through the `agentdial mcp-serve` surface — register a tool in the TOOLS array and wire its handler into the handleToolCall dispatch switch. Use when the maintainer says "let Claude manage X over MCP", "add an MCP tool for <capability>", or a new CLI verb needs an agent-callable equivalent.
---

# Skill: add-mcp-tool

## Trigger

- The maintainer wants an existing CLI capability callable by an agent: "Claude should be able to do X over MCP".
- A new CLI verb (`src/commands/*.ts`) was added and needs a matching MCP tool so `agentdial mcp-serve` exposes it.
- An MCP client (Claude Code) needs a new agent-callable action against the AIP gateway/identity surface.

## Mental model

agentdial is BOTH an AIP gateway AND an MCP server. `agentdial mcp-serve` (`src/commands/mcp-serve.ts`)
speaks JSON-RPC over stdio and advertises a `TOOLS` array (~16 tools today: `identity_status`,
`channel_add`, `gateway_start`, `recipe_run`, `auth_login`, `send_message`, ...). A `tools/list` returns
`TOOLS`; a `tools/call` routes `name` through the `handleToolCall()` switch to a `handle*` function that
returns a `ToolResult` (`{ content: [{ type: "text", text }] }`). The `text(...)` helper builds that shape.

An MCP tool is almost always a thin wrapper over the SAME library/command the CLI verb calls — do NOT
re-implement the logic; import and reuse `src/lib/*` and the command modules. The MCP tool and the CLI verb
must stay behaviorally identical.

## Steps

1. **Define the tool** (model tier: sonnet): add an entry to the `TOOLS` array in `src/commands/mcp-serve.ts`
   with `name` (snake_case, `<noun>_<verb>` e.g. `memory_search`), a one-line `description` an agent can act
   on, and a JSON-Schema `inputSchema` (`{ type: "object", properties: {...}, required: [...] }`). Mirror the
   existing entries — channel-typed args should reference `SUPPORTED_CHANNELS.join(", ")` in the description.
2. **Add the dispatch case** (model tier: sonnet): add `case "<tool_name>": return await handle<Tool>(args);`
   to the `switch (name)` in `handleToolCall()`. Keep it alphabetical-ish, next to its sibling (a memory tool
   near `identity_*`, a channel tool near `channel_*`).
3. **Write the handler** (model tier: sonnet): add `async function handle<Tool>(args: Record<string, unknown>):
   Promise<ToolResult>`. Pull typed args off `args` (validate/cast — it's `unknown`), call the EXISTING
   `src/lib/*` function or command module, and return `text(...)` (or a JSON string inside `text(...)` for
   structured output). Never duplicate command logic — reuse it.
4. **Reuse, do not fork** (model tier: none): if the capability already has a CLI verb (e.g. `memory-search` →
   `cmdMemorySearch` / `buildMemoryIndex`), import that module so the MCP tool and CLI never drift.
5. **Write an eval** (model tier: sonnet): add a behavioral case to `eval/` (or `src/__tests__/`) that calls
   `handleToolCall("<tool_name>", { ...args })` and asserts the `content[0].text` contains the expected result
   — proving the tool is registered AND dispatches.

## Model tier per step

Step 4: none · Steps 1, 2, 3, 5: sonnet (small, surgical diffs).

## Verify (loop until green)

```bash
./node_modules/.bin/tsc                                  # 0 type errors
./node_modules/.bin/vitest run                           # all tests + your new eval pass
node dist/index.js mcp-serve <<< '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'   # tool appears in the list
```

## Expected output

A diff touching only `src/commands/mcp-serve.ts` (one `TOOLS` entry + one `switch` case + one `handle*`
function) plus an eval case — and ZERO duplicated business logic (the handler delegates to existing
`src/lib/*` / command code). `tools/list` advertises the new tool; `tools/call` returns its `ToolResult`.

## Boundaries

Never re-implement a capability in the handler that already lives in `src/lib/` or `src/commands/` — wrap it.
Never return a raw object from a handler; always wrap in `text(...)` so it is a valid `ToolResult`. Never
expose a tool that writes credentials into the repo — credentials live only in
`~/.agentdial/credentials/<channel>.json`. Keep tool `name`s snake_case and stable (renaming breaks clients).
