#!/usr/bin/env node
/**
 * agentdial-mcp: start AgentDial's MCP server over stdio.
 *
 * It is the same server as `agentdial mcp-serve`, exposed as its own bin so any MCP
 * client can start it with one command:
 *   npx -y -p github:naman10parikh/agentdial agentdial-mcp
 * Importing the module attaches the stdio listener; cmdMcpServe() prints the banner
 * to stderr, so stdout carries only JSON-RPC.
 */
import { cmdMcpServe } from "./commands/mcp-serve.js";

await cmdMcpServe();
