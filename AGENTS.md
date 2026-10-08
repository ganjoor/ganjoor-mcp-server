# AGENTS.md

This file provides guidance for using the `ganjoor-mcp-server` with Claude, an AI assistant. It explains how to set up the server, interact with it, and understand its architecture and data model.

## Project Overview

`ganjoor-mcp-server` is an MCP (Model Context Protocol) server that exposes the read-only public Ganjoor Persian poetry API (`api.ganjoor.net`) as MCP tools. It ships 44 tools across 7 tool modules, supports both stdio and streamable HTTP transports, and requires no API key.

## Build & Dev Commands

```bash
npm run build       # compile to dist/ + chmod +x dist/index.js
npm run typecheck   # tsc --noEmit (fast, no emit)
npm test            # live smoke test against api.ganjoor.net (all 44 tools)
npm run inspect     # print real tool output for review
npm run clean       # rm -rf dist
```

Run a single test directly with `tsx`:
```bash
tsx tests/smoke.test.ts
```

Development uses `tsc --watch` (not `tsx`) for incremental compilation. Tests run against the **live** upstream API, not mocks.

## Architecture

```
src/
├── index.ts          # Process entry: stdio or streamable HTTP transport
├── server.ts         # createServer() — registers every tool
├── client.ts         # fetch wrapper, GanjoorApiError, pagination helpers
├── types.ts          # TypeScript interfaces for Ganjoor payloads
├── constants.ts      # Base URLs, limits, server identity
├── schemas.ts        # Shared Zod schemas (pagination, URL slugs, ids)
├── format.ts         # Markdown rendering, response truncation, helpers
└── tools/
    ├── registry.ts   # defineTool() wrapper: consistent errors + both formats
    ├── poets.ts      # Poet discovery (list, get, by-century, books)
    ├── categories.ts # Category browsing
    ├── poems.ts      # Poem retrieval, search, URL resolution
    ├── analysis.ts    # Prosody, rhyme, sections, similar poems
    ├── audio.ts      # Recitations
    ├── content.ts    # Images, quotations, corrections, geo tags
    └── people.ts     # People graph, comments, FAQ
```

### Key Conventions

- **`defineTool()` wraps every registration** — guarantees `isError` results with actionable messages, consistent markdown/JSON rendering, and `structuredContent` alongside text output.
- **`md()` builds documents** — preserves explicit blank lines for proper markdown rendering, drops `null`/`false` for clean conditional fragments.
- **All tools are read-only** — `readOnlyHint`, `idempotentHint`, `openWorldHint` on every tool.
- **`response_format`** argument on every tool: `"markdown"` (default) or `"json"`.
- **URL normalization** — `UrlSlugSchema` in `schemas.ts` adds a leading slash; the upstream API requires it on `?url=` parameters.
- **Pagination** — `fetchPaged()` in `client.ts` fetches one extra record to detect `has_more`; some upstream endpoints ignore paging params and return the full collection, so the server slices locally.
- **Error handling** — `GanjoorApiError` in `client.ts` carries the endpoint and HTTP status; `toActionableError()` converts any thrown value into a user-facing string that names the endpoint and suggests next steps.

## Data Model

Three nested levels: **Poet** → **Category** (book/section) → **Poem** → Verses/Sections/Recitations/Comments. Hafez is poet id `2`, root category `9`, ghazals category `24`. Poem URLs use slugs like `hafez/ghazal/sh494`.

## Upstream Quirks

- Two endpoints (`/poets`, `/rhythms`) ignore paging params — handled client-side in `fetchPaged()`.
- Semantic search returns 503 when the embedding backend is disabled — surfaced as a clear error pointing to text search.
- Rhyme analysis may return a bare string `"no sections"` instead of a structured object.
- Some poem fields are `unknown`-typed in `types.ts` because the upstream API is inconsistent.

## Test Files

- `tests/smoke.test.ts` — live integration test hitting all 44 tools
- `tests/verify-evaluation.ts` — replays 10 evaluation questions through MCP tools
- `tests/verify-shapes.ts` — response shape validation
- `tests/inspect-output.ts` — prints real tool output for manual review
