# eval/

Behavioral evals: golden tasks with binary pass or fail, run by `npm run eval` and by CI on every push.
`behavioral.test.ts` holds 21 cases in four groups: inbound normalization for every channel shape
(L2-001), per-channel reply formatting (L2-002), the full receive, route and format pipeline (L2-003)
and edge cases (L2-004). All mocked, no network. The unit suite lives in `src/__tests__/`.

`baseline.json` records the last accepted pass count. The scheduled improvement loop
(`scripts/improve.mjs`) fails when the pass count drops below it and writes a proposal either way.
