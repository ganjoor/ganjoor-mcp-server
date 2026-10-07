/**
 * Shared constants for the Ganjoor MCP server.
 */

/** Base URL of the Ganjoor REST API. Override with GANJOOR_API_BASE_URL. */
export const API_BASE_URL = (
  process.env.GANJOOR_API_BASE_URL ?? "https://api.ganjoor.net"
).replace(/\/+$/, "");

/** Public web front-end, used to build human-clickable links. */
export const SITE_BASE_URL = (
  process.env.GANJOOR_SITE_BASE_URL ?? "https://ganjoor.net"
).replace(/\/+$/, "");

/** Maximum response size in characters before truncation kicks in. */
export const CHARACTER_LIMIT = 25_000;

/** Default request timeout in milliseconds. */
export const REQUEST_TIMEOUT_MS = 30_000;

/** Upstream caps PageSize at 1000; keep our own limit at or below that. */
export const MAX_PAGE_SIZE = 100;

/** Server identity advertised to MCP clients. */
export const SERVER_NAME = "ganjoor-mcp-server";
export const SERVER_VERSION = "1.0.0";

/** Website shown as the canonical documentation home. */
export const SERVER_INSTRUCTIONS = `Ganjoor (گنجور) is the largest public archive of Persian
classical poetry. This server exposes the read-only, public parts of the Ganjoor REST API
(https://api.ganjoor.net) for browsing poets, collections, poems, verses, prosody/rhyme
analysis, recitations, commentary, and related-people graphs.

Key ideas:
- "Poet" (شاعر) has an id and a URL slug, e.g. Hafez is poet id 2, slug "/hafez".
- "Category" (بخش/دیوان) groups poems inside a poet's work. Root category id for Hafez is 9.
- "Poem" (شعر) has an id and a full URL such as "/hafez/ghazal/sh494".
- Poem text is Persian and right-to-left; return it verbatim, never transliterate or translate
  it unless the user explicitly asks.
- Nearly every tool accepts \`response_format\`: "markdown" (default, readable) or
  "json" (structured, for programmatic use).

Workflow tip: browse with ganjoor_list_poets / ganjoor_get_poet / ganjoor_get_category,
find a poem with ganjoor_search_poems, then read it with ganjoor_get_poem (by URL) or
ganjoor_get_poem_by_id.`;
