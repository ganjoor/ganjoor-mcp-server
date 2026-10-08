# [![tests/: Live integration, shapes, and inspector tests](../.github/assets/banners/tests.svg)](https://github.com/ganjoor)

Live tests against the Ganjoor API, run with `tsx` (no test framework; plain assertions and exit codes).

## Files

- `smoke.test.ts` — `npm test`: boots the server over an in-memory transport and invokes all 44 tools against the live API, failing on any error response.
- `verify-evaluation.ts` — replays the 10 evaluation questions from `evaluation/evaluation.xml` through the MCP tools and checks the answers.
- `verify-shapes.ts` — validates response shapes (pagination envelope, truncation flag, couplet pairing) against live payloads.
- `inspect-output.ts` — `npm run inspect`: prints real tool output for manual review.
