# [![src/: Process entry, fetch client, types, format, and schemas](../.github/assets/banners/src.svg)](https://github.com/ganjoor)

TypeScript source code for the Ganjoor MCP Server.

## Architecture

- `index.ts` — Process entry point: stdio or streamable HTTP transport mode.
- `server.ts` — `createServer()` factory that registers every tool module.
- `client.ts` — Fetch wrapper over `api.ganjoor.net`, error mapping, and pagination helpers.
- `types.ts` — TypeScript interfaces for Ganjoor API payloads.
- `constants.ts` — Upstream URLs, limits, and server identity.
- `schemas.ts` — Shared Zod schemas (pagination, URL slugs, ids).
- `format.ts` — Markdown rendering and response formatting helpers.
- `tools/` — 44 MCP tools across 7 tool modules.
