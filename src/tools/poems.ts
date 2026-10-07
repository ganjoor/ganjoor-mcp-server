import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ganjoorGet, ganjoorPost, fetchPaged, GanjoorApiError } from "../client.js";
import { IdSchema, PaginationSchema, ResponseFormatSchema, UrlSlugSchema } from "../schemas.js";
import { bullets, lines, md, siteUrl } from "../format.js";
import { defineTool, READ_ONLY } from "./registry.js";
import type { GanjoorPoemViewModel, GanjoorVerse } from "../types.js";

function poemSummary(poem: GanjoorPoemViewModel) {
  return {
    id: poem.id,
    title: poem.title,
    full_title: poem.fullTitle,
    full_url: poem.fullUrl,
    couplets_count: poem.coupletsCount ?? null,
    language: poem.language ?? null,
  };
}

function renderPoemList(poems: Array<{ id: number; full_title: string; full_url: string }>): string {
  return md(
    bullets(
      poems.map((poem) => `${poem.full_title} — id \`${poem.id}\` · ${siteUrl(poem.full_url)}`),
      "no poems matched",
    ),
  );
}

/** Register poem retrieval, search, and discovery tools. */
export function registerPoemTools(server: McpServer): void {
  defineTool(
    server,
    {
      name: "ganjoor_search_poems",
      title: "Search Ganjoor Poems",
      description: `Full-text search across all poems on Ganjoor, optionally scoped to one poet or category.

The search matches Persian text inside poem bodies and titles. Use this when you know what the
poem says but not what it is called; use ganjoor_list_category_poems when you know the book.

Args:
  - term (string): Search text. Persian phrases work best; matches are substring based.
  - poet_id (number): Restrict to one poet (default: 0 = all poets)
  - cat_id (number): Restrict to one category (default: 0 = all categories)
  - page (number): Page number, starting from 1 (default: 1)
  - page_size (number): Results per page, 1-100 (default: 20)
  - include_text (boolean): Include each poem's full text in the response (default: false)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { count, page, page_size, has_more, next_page, poems: [{ id, title, full_title, full_url, plain_text? }] }

Examples:
  - "Find poems mentioning 'دل'" -> term='دل', poet_id=2
  - "Search Hafez for 'صبر'" -> term='صبر', poet_id=2
  - "Give me the full text of the matches" -> include_text=true

Notes:
  - Narrow with \`poet_id\` or \`cat_id\` first: unfiltered search over all poems is broad and slow
    to page through.
  - Set \`include_text=true\` only for a small page; full poems are long.`,
      inputSchema: z
        .object({
          term: z
            .string()
            .trim()
            .min(1, "Search term must not be empty")
            .max(200, "Search term must not exceed 200 characters")
            .describe("Persian text to search for, e.g. 'صبر', 'دل', 'معرفت'."),
          poet_id: z
            .number()
            .int()
            .min(0)
            .default(0)
            .describe("Restrict to a poet id. 0 searches all poets."),
          cat_id: z
            .number()
            .int()
            .min(0)
            .default(0)
            .describe("Restrict to a category id. 0 searches all categories."),
          page: PaginationSchema.shape.page,
          page_size: PaginationSchema.shape.page_size,
          include_text: z
            .boolean()
            .default(false)
            .describe("Include the full poem text for each result."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as {
        term: string;
        poet_id: number;
        cat_id: number;
        page: number;
        page_size: number;
        include_text: boolean;
      };

      const list = await fetchPaged<GanjoorPoemViewModel>(
        "/api/ganjoor/poems/search",
        input.page,
        input.page_size,
        {
          term: input.term,
          poetId: input.poet_id > 0 ? input.poet_id : undefined,
          catId: input.cat_id > 0 ? input.cat_id : undefined,
        },
      );

      const poems = list.items.map((poem) => ({
        ...poemSummary(poem),
        ...(input.include_text ? { plain_text: poem.plainText } : {}),
      }));

      const data = {
        term: input.term,
        count: poems.length,
        page: list.page,
        page_size: list.page_size,
        has_more: list.has_more,
        next_page: list.next_page,
        poems,
      };

      return {
        data,
        markdown: () => {
          const scope = input.poet_id ? ` (poet id ${input.poet_id})` : "";
          if (!poems.length) {
            return `No poems matched "${input.term}"${scope}. Try a shorter or more common word, or drop the poet/category filter.`;
          }
          const head = lines(
            `# Search results for "${input.term}"${scope} — ${poems.length} shown (page ${list.page})`,
            list.has_more ? "More results — increase `page`." : null,
          );
          if (!input.include_text) {
            return md(head.join("\n"), "", renderPoemList(poems));
          }
          const body = poems.map((poem) =>
            md(
              `## ${poem.full_title}`,
              `- **Id**: ${poem.id} · **URL**: ${siteUrl(poem.full_url)}`,
              "",
              poem.plain_text ?? null,
            ),
          );
          return md(head.join("\n"), "", body.join("\n\n"));
        },
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_semantic_search_poems",
      title: "Semantic Search Ganjoor Poems",
      description: `Meaning-based ("find a poem about...") search over Ganjoor's poetry collection.

Use this when you want poems by theme or feeling rather than an exact word. Describe the idea in
natural language — in English or Persian — and Ganjoor's embedding search returns the closest
verses. Prefer ganjoor_search_poems when you have an exact phrase to look for.

Args:
  - query (string): Natural-language description of the poem's theme, 1-500 characters
  - top_k (number): How many poems to return, 1-50 (default: 10)
  - poet_id (number): Restrict to a poet id. 0 = all poets (default: 0)
  - cat_id (number): Restrict to a category id. 0 = all categories (default: 0)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { count, results: [{ id, title, full_title, full_url, plain_text }] } ordered by relevance.

Examples:
  - "Poems about patience and divine trust" -> query='patience and trust in God'
  - "غزلی دربارهٔ جدایی از معشوق" -> query='a ghazal about separation from the beloved'

Notes:
  - Ganjoor's semantic backend is an optional feature that some deployments leave disabled; when it
    is off this tool returns a 503 with a message saying so. In that case fall back to
    ganjoor_search_poems with a Persian keyword describing the theme.
  - Relevance ordering is approximate — always quote the returned text rather than paraphrasing it.`,
      inputSchema: z
        .object({
          query: z
            .string()
            .trim()
            .min(1, "Query must not be empty")
            .max(500, "Query must not exceed 500 characters")
            .describe("Natural-language description of the theme, e.g. 'a poem about longing for the beloved'."),
          top_k: z
            .number()
            .int()
            .min(1)
            .max(50)
            .default(10)
            .describe("Number of poems to return (1-50, default 10)."),
          poet_id: z
            .number()
            .int()
            .min(0)
            .default(0)
            .describe("Restrict to a poet id. 0 searches all poets."),
          cat_id: z
            .number()
            .int()
            .min(0)
            .default(0)
            .describe("Restrict to a category id. 0 searches all categories."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as {
        query: string;
        top_k: number;
        poet_id: number;
        cat_id: number;
      };

      let results: GanjoorPoemViewModel[];
      try {
        results = await ganjoorPost<GanjoorPoemViewModel[]>(
          "/api/ganjoor/search/semantic",
          {
            query: input.query,
            topK: input.top_k,
            poetId: input.poet_id,
            catId: input.cat_id,
            disableScopeDetection: false,
          },
          {},
        );
      } catch (error) {
        if (error instanceof GanjoorApiError && error.status === 503) {
          throw new Error(
            "Error: Ganjoor's semantic search is disabled on this server, so meaning-based search is " +
              "unavailable. Use ganjoor_search_poems instead with a Persian keyword describing the theme " +
              `of your question (for example a word meaning "${input.query}").`,
          );
        }
        throw error;
      }

      const list = Array.isArray(results) ? results.slice(0, input.top_k) : [];

      const data = {
        query: input.query,
        count: list.length,
        results: list.map((poem) => ({
          ...poemSummary(poem),
          plain_text: poem.plainText,
        })),
      };

      const resultBlocks = list.map((poem, index) =>
        md(
          `## ${index + 1}. ${poem.fullTitle}`,
          `- **Id**: ${poem.id} · ${siteUrl(poem.fullUrl)}`,
          "",
          poem.plainText,
        ),
      );

      return {
        data,
        markdown: () =>
          md(
            `# Semantic results for "${input.query}" (${list.length} poems)`,
            "",
            list.length
              ? null
              : "No semantically similar poems found. Try rephrasing the theme in simpler words.",
            resultBlocks.join("\n\n"),
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_poem",
      title: "Get Ganjoor Poem By URL",
      description: `Fetch a complete poem by its Ganjoor URL, including verses, metre, rhyme, and recitations.

This is the main way to read a poem. The URL is the same as the browser address on ganjoor.net,
e.g. "hafez/ghazal/sh494". Use ganjoor_search_poems or ganjoor_list_category_poems to discover
URLs, and ganjoor_get_poem_by_id when you only have a numeric id.

Args:
  - url (string): Poem URL slug, with or without leading slash, e.g. 'hafez/ghazal/sh494'
  - include_category (boolean): Include the book/category metadata (default: true)
  - include_siblings (boolean): Include the list of other poems in the same book (default: false)
  - include_recitations (boolean): Include audio recitations (default: true)
  - include_images (boolean): Include manuscript images (default: false)
  - include_comments (boolean): Include published reader comments (default: false)
  - include_verse_details (boolean): Include per-verse ids, positions, and couplet summaries (default: true)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Poem id, title, full title, poet, book/category path, plain text, and the ordered verse list grouped
  into couplets. For JSON: { id, title, full_title, full_url, poet, category, couplets_count, verses: [{ couplet_index, position, text }], recitations: [...], next_poem, previous_poem }

Examples:
  - "Show me Hafez's ghazal 494" -> url='hafez/ghazal/sh494'
  - "Read this poem with its commentary" -> include_comments=true

Notes:
  - Persian text is returned verbatim; it is right-to-left, so present it as-is.
  - Keep include_siblings and include_comments false unless needed — both can be very large.`,
      inputSchema: z
        .object({
          url: UrlSlugSchema,
          include_category: z
            .boolean()
            .default(true)
            .describe("Include the poem's category/book metadata."),
          include_siblings: z
            .boolean()
            .default(false)
            .describe("Include all other poems in the same book. Can be very large."),
          include_recitations: z
            .boolean()
            .default(true)
            .describe("Include audio recitations of the poem."),
          include_images: z
            .boolean()
            .default(false)
            .describe("Include manuscript image links."),
          include_comments: z
            .boolean()
            .default(false)
            .describe("Include published reader comments."),
          include_verse_details: z
            .boolean()
            .default(true)
            .describe("Include per-verse ids, positions, and AI summaries."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as {
        url: string;
        include_category: boolean;
        include_siblings: boolean;
        include_recitations: boolean;
        include_images: boolean;
        include_comments: boolean;
        include_verse_details: boolean;
      };

      const poem = await ganjoorGet<GanjoorPoemViewModel>("/api/ganjoor/poem", {
        url: input.url,
        catInfo: input.include_category,
        catPoems: input.include_siblings,
        rhymes: true,
        recitations: input.include_recitations,
        images: input.include_images,
        songs: false,
        comments: input.include_comments,
        // Upstream drops the verse array entirely when this is false, so it stays
        // on and `include_verse_details` only controls local rendering.
        verseDetails: true,
        navigation: true,
      });

      return buildPoemResponse(poem, input);
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_poem_by_id",
      title: "Get Ganjoor Poem By Id",
      description: `Fetch a complete poem by its numeric Ganjoor id.

Same content as ganjoor_get_poem, but keyed on the numeric poem id instead of the URL. Use it when
you have an id from search results or another tool and do not want to build a URL.

Args:
  - poem_id (number): Numeric poem id
  - include_category (boolean): Include the book/category metadata (default: true)
  - include_recitations (boolean): Include audio recitations (default: false)
  - include_comments (boolean): Include published reader comments (default: false)
  - include_verse_details (boolean): Include per-verse ids and positions plus the prose summary for each couplet (default: true). Set false for a leaner payload; the verse text itself is always returned.
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Identical shape to ganjoor_get_poem.

Examples:
  - "Show poem 2623" -> poem_id=2623
  - "What is poem 13836?" -> poem_id=13836

Notes:
  - Combined with ganjoor_get_page_url you can also resolve an id to its web address.`,
      inputSchema: z
        .object({
          poem_id: IdSchema.describe("Numeric poem id, e.g. 2623 for a Hafez ghazal."),
          include_category: z.boolean().default(true).describe("Include category metadata."),
          include_recitations: z.boolean().default(false).describe("Include audio recitations."),
          include_comments: z.boolean().default(false).describe("Include reader comments."),
          include_verse_details: z
            .boolean()
            .default(true)
            .describe("Include per-verse ids, positions, and summaries."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as {
        poem_id: number;
        include_category: boolean;
        include_recitations: boolean;
        include_comments: boolean;
        include_verse_details: boolean;
      };

      const poem = await ganjoorGet<GanjoorPoemViewModel>(
        `/api/ganjoor/poem/${input.poem_id}`,
        {
          catInfo: input.include_category,
          recitations: input.include_recitations,
          images: false,
          songs: false,
          comments: input.include_comments,
          verseDetails: true,
        },
      );

      return buildPoemResponse(poem, input);
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_poem_verses",
      title: "Get Ganjoor Poem Verses",
      description: `Get just the verses of a poem by id — a lightweight alternative to fetching the whole poem.

Each verse comes back in order with its couplet index and whether it is the first or second hemi-
stich. Optionally restrict to a single couplet.

Args:
  - poem_id (number): Numeric poem id
  - couplet_index (number): Return only this couplet (0-based). Omit for the whole poem.
  - include_summary (boolean): Include the per-couplet prose summary (default: false)
  - include_original_text (boolean): Include the uncorrected original text where available (default: false)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { poem_id, verse_count, verses: [{ id, order, couplet_index, position, text }] }

Examples:
  - "Quote the verses of poem 2623" -> poem_id=2623
  - "Show only couplet 3" -> poem_id=2623, couplet_index=3

Notes:
  - Position 0 is the first hemistich, position 1 the second; couplet_index groups them.`,
      inputSchema: z
        .object({
          poem_id: IdSchema.describe("Numeric poem id."),
          couplet_index: z
            .number()
            .int()
            .min(0)
            .optional()
            .describe("Return only this 0-based couplet. Omit to get the whole poem."),
          include_summary: z
            .boolean()
            .default(false)
            .describe("Include the modern Persian summary attached to each couplet."),
          include_original_text: z
            .boolean()
            .default(false)
            .describe("Include the pre-correction original text where the API has it."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as {
        poem_id: number;
        couplet_index?: number;
        include_summary: boolean;
        include_original_text: boolean;
      };

      const verses = await ganjoorGet<GanjoorVerse[]>(
        `/api/ganjoor/poem/${input.poem_id}/verses`,
        { coupletIndex: input.couplet_index ?? -1 },
      );

      const list = Array.isArray(verses) ? verses : [];

      const data = {
        poem_id: input.poem_id,
        verse_count: list.length,
        verses: list.map((verse) => ({
          id: verse.id,
          order: verse.vOrder,
          couplet_index: verse.coupletIndex,
          position: verse.versePosition,
          text: verse.text,
          ...(input.include_summary ? { couplet_summary: verse.coupletSummary } : {}),
          ...(input.include_original_text ? { original_text: verse.originalText } : {}),
        })),
      };

      return {
        data,
        markdown: () =>
          md(            `# Verses of poem ${input.poem_id} (${list.length} hemistichs)`,
            "",
            list.length
              ? ""
              : "No verses returned — verify the poem id with ganjoor_search_poems.",
            ...list.map((verse) => `[${verse.versePosition === 0 ? "۱" : "۲"}] ${verse.text}`),
            "",
                    ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_random_poem",
      title: "Get Random Ganjoor Poem",
      description: `Get a random poem from Ganjoor, optionally from a specific poet.

Args:
  - poet_id (number): Poet to draw from. 0 = a random poet (default: 0). Hafez = 2.
  - include_recitations (boolean): Include audio recitations (default: false)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  A single complete poem in the same shape as ganjoor_get_poem_by_id.

Examples:
  - "Surprise me with a poem" -> no arguments
  - "A random Saadi poem" -> poet_id=7

Notes:
  - Non-deterministic: repeated calls return different poems.`,
      inputSchema: z
        .object({
          poet_id: z
            .number()
            .int()
            .min(0)
            .default(0)
            .describe("Poet id to draw from. 0 = any poet. Hafez = 2, Saadi = 7, Rumi = 5."),
          include_recitations: z.boolean().default(false).describe("Include audio recitations."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as { poet_id: number; include_recitations: boolean };

      const poem = await ganjoorGet<GanjoorPoemViewModel>("/api/ganjoor/poem/random", {
        poetId: input.poet_id,
      });

      return buildPoemResponse(poem, {
        include_category: true,
        include_recitations: input.include_recitations,
        include_comments: false,
        include_verse_details: true,
      });
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_hafez_faal",
      title: "Get Hafez Faal (Divination)",
      description: `Draw a random Hafez ghazal as a Persian divination (فال حافظ).

This is the traditional "ask Hafez" reading: one ghazal selected at random, to be interpreted in
the context of the question asked. Each call draws a different ghazal.

Args:
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  A complete Hafez ghazal in the same shape as ganjoor_get_poem_by_id.

Examples:
  - "Draw a faal for me" -> no arguments
  - "What does Hafez say about my question?" -> no arguments

Notes:
  - Non-deterministic. The interpretation is traditionally left to the reader.`,
      inputSchema: z.object({ response_format: ResponseFormatSchema }).strict(),
      annotations: READ_ONLY,
    },
    async () => {
      const poem = await ganjoorGet<GanjoorPoemViewModel>("/api/ganjoor/hafez/faal");
      return buildPoemResponse(poem, {
        include_category: true,
        include_recitations: false,
        include_comments: false,
        include_verse_details: true,
      });
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_page_url",
      title: "Resolve Ganjoor Page Id To URL",
      description: `Resolve any Ganjoor page id (poem, category, or poet) to its public web URL path.

Useful when you have a bare numeric id from an index or a citation and need to cite or link it.

Args:
  - id (number): Any Ganjoor page id — poem, category, or poet
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { id, url, full_url }

Examples:
  - "What is the link for id 13836?" -> id=13836

Notes:
  - Ids are globally unique across poems, categories and poets on Ganjoor.`,
      inputSchema: z
        .object({
          id: IdSchema.describe("Page id to resolve. Works for poems, categories, and poets."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as { id: number };
      const url = await ganjoorGet<string>("/api/ganjoor/pageurl", { id: input.id });

      const data = {
        id: input.id,
        url: typeof url === "string" ? url : String(url ?? ""),
        full_url: siteUrl(typeof url === "string" ? url : String(url ?? "")),
      };

      return {
        data,
        markdown: () =>
          md(            `# Ganjoor page ${input.id}`,
            `- **URL path**: \`${data.url}\``,
            `- **Full URL**: ${data.full_url}`,
            "",
                    ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_redirect_url",
      title: "Resolve Ganjoor Redirect",
      description: `Resolve a legacy or short Ganjoor URL to its current canonical address.

Ganjoor has renamed many sections over the years; this endpoint maps an old path to today's one.

Args:
  - url (string): The URL path to resolve, with or without a leading slash
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { requested_url, redirect_url, full_url, has_redirect } — redirect_url is null and
  has_redirect is false when Ganjoor has no redirect for that URL (which includes URLs that are
  already canonical).

Examples:
  - "Where does an old Hafez section URL go now?" -> url='hafez/divan/ghazal/sh1'

Notes:
  - Ganjoor only keeps explicit redirects for paths it actually renamed; most valid URLs return
    has_redirect=false rather than a target.`,
      inputSchema: z
        .object({
          url: UrlSlugSchema.describe("URL path to resolve, e.g. 'hafez/divan'."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as { url: string };

      // The upstream endpoint 404s both for unknown paths and for URLs that are
      // already canonical (no redirect row exists). Both mean "no redirect".
      let target: string | null = null;
      try {
        const raw = await ganjoorGet<string | null>("/api/ganjoor/redirecturl", { url: input.url });
        target = typeof raw === "string" && raw.trim() ? raw.trim() : null;
      } catch (error) {
        if (!(error instanceof GanjoorApiError) || error.status !== 404) throw error;
      }

      const redirect = target;

      const data = {
        requested_url: input.url,
        redirect_url: redirect,
        full_url: redirect ? siteUrl(redirect) : null,
        has_redirect: redirect !== null,
      };

      return {
        data,
        markdown: () =>
          md(            `# Redirect resolution`,
            `- **Requested**: \`${input.url}\``,
            redirect
              ? `- **Redirects to**: \`${redirect}\` (${siteUrl(redirect)})`
              : "- **Redirects to**: no redirect — this URL is either already canonical or not tracked by Ganjoor",
            "",
                    ),
      };
    },
  );
}

/** Shared shaping logic for every tool that returns a full poem payload. */
function buildPoemResponse(
  poem: GanjoorPoemViewModel,
  options: {
    include_category: boolean;
    include_recitations: boolean;
    include_comments: boolean;
    include_verse_details: boolean;
  },
) {
  // `verses` is only an array when the upstream `verseDetails` flag was set;
  // otherwise it arrives as an empty object.
  const verses: GanjoorVerse[] = Array.isArray(poem.verses) ? poem.verses : [];
  const recitations = poem.recitations ?? [];
  const comments = poem.comments ?? [];
  // With catInfo=true the category arrives wrapped as { poet, cat }.
  const category = options.include_category ? poem.category?.cat ?? null : null;
  const poet = options.include_category ? poem.category?.poet ?? null : null;

  const data: Record<string, unknown> = {
    id: poem.id,
    title: poem.title,
    full_title: poem.fullTitle,
    full_url: poem.fullUrl,
    web_url: siteUrl(poem.fullUrl),
    plain_text: poem.plainText,
    source_name: poem.sourceName ?? null,
    language: poem.language ?? null,
    verse_count: verses.length,
    // Upstream never populates coupletsCount, so derive it from the verses.
    couplets_count:
      verses.length > 0 ? new Set(verses.map((verse) => verse.coupletIndex)).size : null,
    ...(category
      ? {
          category: {
            id: category.id,
            title: category.title,
            full_url: category.fullUrl,
            cat_type: category.catType,
          },
        }
      : {}),
    ...(poet
      ? {
          poet: { id: poet.id, name: poet.name, full_url: poet.fullUrl },
        }
      : {}),
    ...(poem.next
      ? { next_poem: { id: poem.next.id, title: poem.next.title, url_slug: poem.next.urlSlug } }
      : {}),
    ...(poem.previous
      ? {
          previous_poem: {
            id: poem.previous.id,
            title: poem.previous.title,
            url_slug: poem.previous.urlSlug,
          },
        }
      : {}),
    verses: verses.map((verse) => ({
      id: options.include_verse_details ? verse.id : null,
      order: verse.vOrder,
      couplet_index: verse.coupletIndex,
      position: verse.versePosition,
      text: verse.text,
      ...(options.include_verse_details ? { couplet_summary: verse.coupletSummary } : {}),
    })),
    ...(options.include_recitations
      ? {
          recitations: recitations.map((recitation) => ({
            id: recitation.id,
            title: recitation.audioTitle,
            artist: recitation.audioArtist,
            artist_url: recitation.audioArtistUrl,
            audio_url: recitation.audioSrcUrl || recitation.mp3FilePath || recitation.audioSrc,
            publish_date: recitation.publishDate,
          })),
        }
      : {}),
    ...(options.include_comments
      ? {
          comments: comments.map((comment) => ({
            id: comment.id,
            user: comment.userName,
            text: comment.text,
            date: comment.sendDate,
            couplet_index: comment.coupletIndex,
            has_owner_response: comment.hasOwnerResponse,
          })),
        }
      : {}),
  };

  const recitationBlock =
    options.include_recitations && recitations.length
      ? md(
          "## Recitations",
          "",
          bullets(
            recitations.map(
              (recitation) =>
                `${recitation.audioTitle ?? "untitled"} — ${recitation.audioArtist ?? "unknown artist"}${
                  recitation.audioSrcUrl ? ` · ${recitation.audioSrcUrl}` : ""
                }`,
            ),
          ),
        )
      : null;

  const commentBlock =
    options.include_comments && comments.length
      ? md(
          "## Comments",
          "",
          bullets(
            comments
              .slice(0, 20)
              .map(
                (comment) =>
                  `${comment.userName ?? "anonymous"}: ${(comment.text ?? "").slice(0, 200)}`,
              ),
          ),
        )
      : null;

  // Upstream always reports coupletsCount as null, so derive it from the verses.
  const coupletsCount =
    poem.coupletsCount ??
    (verses.length > 0
      ? new Set(verses.map((verse) => verse.coupletIndex)).size
      : null);

  const markdown = md(
    `# ${poem.fullTitle}`,
    `- **Id**: ${poem.id}`,
    `- **URL**: ${siteUrl(poem.fullUrl)}`,
    poet ? `- **Poet**: ${poet.name} (${siteUrl(poet.fullUrl)})` : null,
    category ? `- **Book**: ${category.title} (category id ${category.id})` : null,
    coupletsCount ? `- **Couplets**: ${coupletsCount}` : null,
    "",
    "## Verses",
    "",
    verses.length ? null : "No verses returned.",
    groupVersesIntoCouplets(verses, options.include_verse_details).join("\n\n"),
    recitationBlock,
    commentBlock,
  );

  return { data, markdown: () => markdown };
}

/** Group hemistichs back into couplets for readable markdown. */
function groupVersesIntoCouplets(
  verses: GanjoorVerse[],
  includeDetails: boolean,
): string[] {
  const byCouplet = new Map<number, GanjoorVerse[]>();
  for (const verse of verses) {
    const bucket = byCouplet.get(verse.coupletIndex) ?? [];
    bucket.push(verse);
    byCouplet.set(verse.coupletIndex, bucket);
  }

  const blocks: string[] = [];
  for (const [index, pair] of [...byCouplet.entries()].sort((a, b) => a[0] - b[0])) {
    const ordered = [...pair].sort((a, b) => a.versePosition - b.versePosition);
    const text = ordered.map((verse) => verse.text).join("\n");
    const summary = includeDetails ? ordered.find((verse) => verse.coupletSummary)?.coupletSummary : null;
    blocks.push(
      summary
        ? `${String(index + 1).padStart(3, " ")}. ${text}\n     _${summary}_`
        : `${String(index + 1).padStart(3, " ")}. ${text}`,
    );
  }
  return blocks;
}
