import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ganjoorGet, fetchPaged } from "../client.js";
import { IdSchema, PaginationSchema, ResponseFormatSchema } from "../schemas.js";
import { bullets, date, md, siteUrl } from "../format.js";
import { defineTool, READ_ONLY } from "./registry.js";
import type {
  GanjoorPoemViewModel,
  GanjoorRecitation,
  GanjoorRecitationSyncPoint,
} from "../types.js";

/** Register audio recitation tools. */
export function registerAudioTools(server: McpServer): void {
  defineTool(
    server,
    {
      name: "ganjoor_search_recitations",
      title: "Search Ganjoor Recitations",
      description: `Search the published audio recitations (روایت) of Ganjoor poems, optionally by reciter or poem.

Each recitation is a sung or spoken performance of one poem by a named artist, published on
ganjoor.net.

Args:
  - search_term (string): Optional text to match against the reciter's (artist's) name
  - poet_id (number): Restrict to a poet id. 0 = all poets (default: 0)
  - cat_id (number): Restrict to a category id. 0 = all categories (default: 0)
  - page (number): Page number, starting from 1 (default: 1)
  - page_size (number): Items per page, 1-100 (default: 20)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { count, page, page_size, has_more, next_page, recitations: [{ id, poem_id, poem_title, poem_url, artist, title, publish_date, duration_seconds }] }

Examples:
  - "Any recitations by محمدرضا ضیاء?" -> search_term='محمدرضا ضیاء'
  - "Recitations of Hafez's ghazals" -> poet_id=2

Notes:
  - When scoped to a poet or category, results are ordered by poem id; otherwise by publish date,
    newest first.`,
      inputSchema: z
        .object({
          search_term: z
            .string()
            .trim()
            .max(200)
            .default("")
            .describe("Text to match against the reciter's name. Empty matches all artists."),
          poet_id: z
            .number()
            .int()
            .min(0)
            .default(0)
            .describe("Restrict to a poet id. 0 = all poets."),
          cat_id: z
            .number()
            .int()
            .min(0)
            .default(0)
            .describe("Restrict to a category id. 0 = all categories."),
          page: PaginationSchema.shape.page,
          page_size: PaginationSchema.shape.page_size,
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as {
        search_term: string;
        poet_id: number;
        cat_id: number;
        page: number;
        page_size: number;
      };

      const list = await fetchPaged<GanjoorRecitation>("/api/audio/published", input.page, input.page_size, {
        searchTerm: input.search_term || undefined,
        poetId: input.poet_id > 0 ? input.poet_id : undefined,
        catId: input.cat_id > 0 ? input.cat_id : undefined,
      });

      const recitations = list.items.map((recitation) => ({
        id: recitation.id,
        poem_id: recitation.poemId,
        poem_title: recitation.poemFullTitle,
        poem_url: recitation.poemFullUrl,
        artist: recitation.audioArtist,
        title: recitation.audioTitle,
        publish_date: recitation.publishDate,
        duration_seconds: recitation.durationSeconds ?? null,
      }));

      const data = {
        count: recitations.length,
        page: list.page,
        page_size: list.page_size,
        has_more: list.has_more,
        next_page: list.next_page,
        recitations,
      };

      return {
        data,
        markdown: () =>
          md(
            `# Recitations (${recitations.length} shown, page ${list.page})`,
            list.has_more ? "More — increase `page`." : null,
            "",
            bullets(
              recitations.map(
                (recitation) =>
                  `${recitation.poem_title ?? `poem ${recitation.poem_id}`} — ${recitation.artist ?? "unknown artist"}${
                    recitation.publish_date ? `, ${recitation.publish_date}` : ""
                  } (recitation id \`${recitation.id}\`)${
                    recitation.poem_url ? ` · ${siteUrl(recitation.poem_url)}` : ""
                  }`,
              ),
              "no recitations matched",
            ),
            "",
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_recitation",
      title: "Get Ganjoor Recitation",
      description: `Get one published recitation by its numeric id, including its audio file location and poem reference.

Args:
  - recitation_id (number): Recitation id (from ganjoor_search_recitations or a poem's recitation list)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { id, poem_id, poem_title, poem_url, title, artist, artist_url, audio_url, publish_date, duration_seconds, review_status }

Examples:
  - "Details for recitation 37535" -> recitation_id=37535

Notes:
  - Audio URLs point at Ganjoor's CDN and are stable once published.`,
      inputSchema: z
        .object({
          recitation_id: IdSchema.describe("Numeric recitation id."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as { recitation_id: number };
      const recitation = await ganjoorGet<GanjoorRecitation>(
        `/api/audio/published/${input.recitation_id}`,
      );

      const data = {
        id: recitation.id,
        poem_id: recitation.poemId,
        poem_title: recitation.poemFullTitle,
        poem_url: recitation.poemFullUrl,
        title: recitation.audioTitle,
        artist: recitation.audioArtist,
        artist_url: recitation.audioArtistUrl,
        audio_url: recitation.audioSrcUrl || recitation.mp3FilePath || recitation.audioSrc,
        publish_date: recitation.publishDate,
        duration_seconds: recitation.durationSeconds ?? null,
        review_status: recitation.reviewStatus ?? null,
      };

      return {
        data,
        markdown: () =>
          md(
            `# Recitation ${recitation.id}`,
            `- **Poem**: ${recitation.poemFullTitle ?? "—"}`,
            `- **Poem URL**: ${siteUrl(recitation.poemFullUrl) ?? "—"}`,
            `- **Title**: ${recitation.audioTitle ?? "—"}`,
            `- **Artist**: ${recitation.audioArtist ?? "—"}${
              recitation.audioArtistUrl ? ` (${recitation.audioArtistUrl})` : ""
            }`,
            `- **Published**: ${date(recitation.publishDate)}`,
            data.audio_url ? `- **Audio**: ${data.audio_url}` : null,
            "",
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_recitation_sync_info",
      title: "Get Recitation Verse Sync Timing",
      description: `Get the per-verse timing map for a recitation, showing when each couplet begins in the audio.

Useful for following along with the text while a recitation plays.

Args:
  - recitation_id (number): Recitation id
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { recitation_id, sync_point_count, total_duration_ms, sync_points: [{ verse_order, text, start_time_ms, start_time_seconds }] }

Examples:
  - "Sync data for recitation 37535" -> recitation_id=37535

Notes:
  - Not every recitation has timing data; an empty list is normal for older uploads.`,
      inputSchema: z
        .object({
          recitation_id: IdSchema.describe("Numeric recitation id."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as { recitation_id: number };
      // This endpoint returns a bare array of timed verse markers, not an object.
      const points = await ganjoorGet<GanjoorRecitationSyncPoint[]>(
        `/api/audio/verses/${input.recitation_id}`,
      );
      const markers = Array.isArray(points) ? points : [];

      const data = {
        recitation_id: input.recitation_id,
        sync_point_count: markers.length,
        total_duration_ms:
          markers.length > 0 ? markers[markers.length - 1].audioStartMilliseconds : null,
        sync_points: markers.map((point) => ({
          verse_order: point.verseOrder,
          text: point.verseText ?? null,
          start_time_ms: point.audioStartMilliseconds,
          start_time_seconds:
            typeof point.audioStartMilliseconds === "number"
              ? Number((point.audioStartMilliseconds / 1000).toFixed(1))
              : null,
        })),
      };

      return {
        data,
        markdown: () =>
          md(
            `# Verse sync — recitation ${input.recitation_id}`,
            `- **Sync points**: ${markers.length}`,
            "",
            bullets(
              data.sync_points.map(
                (point) =>
                  `[${(point.start_time_ms / 1000).toFixed(1)}s] verse ${point.verse_order}${
                    point.text ? ` — ${point.text}` : ""
                  }`,
              ),
              "no timing data for this recitation",
            ),
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_poem_recitations",
      title: "Get Poem Recitations",
      description: `List every audio recitation published for one poem.

Args:
  - poem_id (number): Numeric poem id
  - page (number): Page number, starting from 1 (default: 1)
  - page_size (number): Items per page, 1-100 (default: 20)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { poem_id, count, page, page_size, has_more, next_page, recitations: [{ id, artist, title, publish_date, duration_seconds }] }

Examples:
  - "How has poem 2623 been recited?" -> poem_id=2623

Notes:
  - Text fields are intentionally blank upstream; fetch the poem itself for its text.`,
      inputSchema: z
        .object({
          poem_id: IdSchema.describe("Numeric poem id."),
          page: PaginationSchema.shape.page,
          page_size: PaginationSchema.shape.page_size,
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as { poem_id: number; page: number; page_size: number };
      const all = await ganjoorGet<GanjoorRecitation[]>(`/api/ganjoor/poem/${input.poem_id}/recitations`);
      const list = Array.isArray(all) ? all : [];

      const start = (input.page - 1) * input.page_size;
      const items = list.slice(start, start + input.page_size);
      const hasMore = start + items.length < list.length;

      const data = {
        poem_id: input.poem_id,
        total: list.length,
        count: items.length,
        page: input.page,
        page_size: input.page_size,
        has_more: hasMore,
        next_page: hasMore ? input.page + 1 : null,
        recitations: items.map((recitation) => ({
          id: recitation.id,
          artist: recitation.audioArtist,
          title: recitation.audioTitle,
          publish_date: recitation.publishDate,
          duration_seconds: recitation.durationSeconds ?? null,
          audio_url: recitation.audioSrcUrl || recitation.mp3FilePath || recitation.audioSrc,
        })),
      };

      return {
        data,
        markdown: () =>
          md(
            `# Recitations of poem ${input.poem_id} (${items.length} of ${list.length})`,
            "",
            bullets(
              items.map(
                (recitation) =>
                  `${recitation.audioArtist ?? "unknown artist"} — ${recitation.audioTitle ?? "untitled"}${
                    recitation.publishDate ? `, ${recitation.publishDate}` : ""
                  } (id \`${recitation.id}\`)`,
              ),
              "this poem has no published recitations",
            ),
            "",
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_category_top_recitations",
      title: "Get Top Recitations For A Category",
      description: `Get the most-liked recitations within a category — Ganjoor's "top 1" (بهترین) listings for a book.

Args:
  - cat_id (number): Category id
  - include_poem_text (boolean): Include each poem's text (default: false)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { cat_id, count, recitations: [{ recitation_id, poem_id, poem_title, artist, score, plain_text? }] }

Examples:
  - "The best-known recitations of Hafez's ghazals" -> find the ghazals category id, then call this

Notes:
  - Ordering is by community upvote score, which changes over time.
  - The ghazals category for Hafez is id 10.`,
      inputSchema: z
        .object({
          cat_id: IdSchema.describe("Category id."),
          include_poem_text: z
            .boolean()
            .default(false)
            .describe("Include the full poem text alongside each recitation."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as { cat_id: number; include_poem_text: boolean };
      const result = await ganjoorGet<{
        recitations?: Array<Record<string, unknown>>;
        verses?: Array<Record<string, unknown>>;
      }>(`/api/audio/cattop1/${input.cat_id}`, { includePoemText: input.include_poem_text });

      const recitations = (result?.recitations ?? []) as Array<Record<string, unknown>>;

      const data = {
        cat_id: input.cat_id,
        count: recitations.length,
        recitations: recitations.map((recitation) => ({
          recitation_id: recitation.id ?? recitation.narrationId ?? null,
          poem_id: recitation.poemId ?? null,
          poem_title: recitation.poemFullTitle ?? recitation.poemTitle ?? null,
          artist: recitation.audioArtist ?? null,
          score: recitation.score ?? recitation.rating ?? null,
          ...(input.include_poem_text ? { plain_text: recitation.plainText ?? null } : {}),
        })),
      };

      return {
        data,
        markdown: () =>
          md(
            `# Top recitations in category ${input.cat_id} (${recitations.length})`,
            "",
            bullets(
              recitations.map(
                (recitation) =>
                  `${recitation.poemFullTitle ?? recitation.poemTitle ?? `poem ${recitation.poemId}`} — ${
                    recitation.audioArtist ?? "unknown artist"
                  }${recitation.score ? ` (score ${recitation.score})` : ""}`,
              ),
              "no recitations found for this category",
            ),
            "",
          ),
      };
    },
  );
}

/** Shared shape used when a recitation list is embedded in a poem payload. */
export type RecitationSummary = Pick<
  GanjoorRecitation,
  "id" | "audioArtist" | "audioTitle" | "audioSrcUrl"
>;

/** Re-export for callers building composite responses. */
export type { GanjoorPoemViewModel };
