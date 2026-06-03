# agentdial — Heartbeat

## Schedule

| Check                            | Frequency      | Action on Anomaly                                      |
| -------------------------------- | -------------- | ------------------------------------------------------ |
| Gateway /health endpoint         | Every 1 minute | If non-200: restart gateway, alert orchestrator        |
| Configured channel credential check | Every 6 hours | If creds missing: log warning, skip channel            |
| Inbound webhook latency          | Per-message    | If >5s: log warning with channel + message ID          |
| Agent backend reachability       | Every 15 min   | If timeout 3x: pause routing, alert orchestrator       |
| Test suite (pnpm test)           | On code change | If red: block deploy, open issue                       |
| Behavioral evals (eval/)         | Daily (CI)     | If regression: alert maintainer via GitHub issue       |

## Health Indicators

- **Healthy**: Gateway running, ≥1 channel active, last route <1 min ago, 0 errors in 1h
- **Warning**: Gateway running but 0 active channels OR last route >15 min ago OR 1-2 errors/h
- **Critical**: Gateway down OR agent backend unreachable OR 3+ routing errors/h → auto-pause, alert

## Recovery

1. Check gateway process: `agentdial status`
2. Check channel credentials: `agentdial channels list`
3. Check agent backend URL: `curl $AGENT_URL/health`
4. Review last error in `~/.agentdial/logs/gateway.jsonl`
5. Check `memory/LEARNINGS.md` for known fixes
6. If fixable: apply fix, restart gateway, resume
7. If not: signal orchestrator via `.done` / `.needs-help`, preserve state
