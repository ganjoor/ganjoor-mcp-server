# [![tests/: Live integration, shapes, and inspector tests](../.github/assets/banners/tests.svg)](https://github.com/ganjoor)

Tests run with `tsx` and use Node's built-in assertions.

## Files

- `semantic-search.test.ts` — verifies the semantic search host, response mapping, and text search routing with mocked HTTP responses.
- `smoke.test.ts` — boots the server over an in-memory transport and invokes all 44 tools against the live API.
- `verify-evaluation.ts` — replays the 10 evaluation questions from `evaluation/evaluation.xml` through the MCP tools and checks the answers.
- `verify-shapes.ts` — validates response shapes (pagination envelope, truncation flag, couplet pairing) against live payloads.
- `inspect-output.ts` — `npm run inspect`: prints real tool output for manual review.
