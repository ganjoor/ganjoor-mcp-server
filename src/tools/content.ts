import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ganjoorGet } from "../client.js";
import { IdSchema, ResponseFormatSchema } from "../schemas.js";
import { bullets, md, siteUrl } from "../format.js";
import { defineTool, READ_ONLY } from "./registry.js";
import type { GanjoorQuotedPoem } from "../types.js";

interface GanjoorPoemImage {
  id: number;
  poemId?: number;
  url?: string;
  src?: string;
  alt?: string;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  index?: number;
}

/** Register supplementary poem-content tools. */
export function registerContentTools(server: McpServer): void {
  defineTool(
    server,
    {
      name: "ganjoor_get_poem_images",
      title: "Get Poem Manuscript Images",
      description: `Get the manuscript and facsimile images Ganjoor holds for a poem.

These are photographs of the physical manuscripts, with a thumbnail and a full-resolution link per
image — useful for checking a textual variant against its source.

Args:
  - poem_id (number): Numeric poem id
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { poem_id, image_count, images: [{ id, url, thumbnail_url, alt, description }] }

Examples:
  - "Show the manuscript for poem 2623" -> poem_id=2623

Notes:
  - Most poems have no images; an empty list is the normal case.`,
      inputSchema: z
        .object({
          poem_id: IdSchema.describe("Numeric poem id."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as { poem_id: number };
      const images = await ganjoorGet<GanjoorPoemImage[]>(
        `/api/ganjoor/poem/${input.poem_id}/images`,
      );
      const list = Array.isArray(images) ? images : [];

      const data = {
        poem_id: input.poem_id,
        image_count: list.length,
        images: list.map((image) => ({
          id: image.id,
          url: image.url ?? image.src ?? null,
          thumbnail_url: image.thumbnailUrl ?? null,
          alt: image.alt ?? image.title ?? null,
          description: image.description ?? null,
        })),
      };

      return {
        data,
        markdown: () =>
          md(
            `# Images for poem ${input.poem_id} (${list.length})`,
            "",
            bullets(
              list.map(
                (image) =>
                  `${image.alt ?? image.title ?? `image ${image.id}`}${
                    image.url ? ` — ${siteUrl(image.url) ?? image.url}` : ""
                  }`,
              ),
              "this poem has no manuscript images",
            ),
            "",
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_poem_quoted_poems",
      title: "Get Poems Quoted By A Poem",
      description: `Get the poems that a given poem quotes or alludes to, and the poems that quote it.

Matching in metre and rhyme is common in Persian poetry — poets answer each other by reusing the
other's metre and rhyme. This endpoint maps those links in both directions.

Args:
  - poem_id (number): Numeric poem id
  - only_both_poems (boolean): Only keep pairs where both poems claim the quotation (default: false)
  - published_only (boolean): Only keep published records (default: true)
  - main_list_only (boolean): Only keep records curated onto the main "related poems" list (default: false)
  - skip (number): Results to skip (default: 0)
  - items_count (number): How many to return. 0 or negative returns all (default: 20)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { poem_id, total, returned, quotes: [{ id, related_poem_id, related_poet_name, related_poem_title, related_poem_url, is_prior, quoted_couplet, quoting_couplet, claimed_by_both, note }] }

Examples:
  - "Which poems does this one answer?" -> poem_id=<id>

Notes:
  - Each record pairs the quoted couplet with the couplet in the other poem that quotes it, so the
    actual verbal borrowing is visible.
  - \`is_prior: true\` means this poem came first chronologically.
  - \`items_count=0\` returns everything, which can be large.`,
      inputSchema: z
        .object({
          poem_id: IdSchema.describe("Numeric poem id."),
          only_both_poems: z
            .boolean()
            .default(false)
            .describe("Only include quotations both poems acknowledge."),
          published_only: z.boolean().default(true).describe("Only include published records."),
          main_list_only: z
            .boolean()
            .default(false)
            .describe("Only include records curated onto the main related-poems list."),
          skip: z.number().int().min(0).default(0).describe("Results to skip."),
          items_count: z
            .number()
            .int()
            .default(20)
            .describe("How many results to return. 0 or less returns all."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as {
        poem_id: number;
        only_both_poems: boolean;
        published_only: boolean;
        main_list_only: boolean;
        skip: number;
        items_count: number;
      };

      const quotes = await ganjoorGet<GanjoorQuotedPoem[]>(
        `/api/ganjoor/poem/${input.poem_id}/quoteds`,
        {
          skip: input.skip,
          itemsCount: input.items_count,
          onlyClaimedByBothPoets: input.only_both_poems,
          published: input.published_only,
          chosenForMainList: input.main_list_only,
        },
      );

      const list = Array.isArray(quotes) ? quotes : [];

      const data = {
        poem_id: input.poem_id,
        total: list.length,
        returned: list.length,
        quotes: list.map((quote) => ({
          id: quote.id,
          related_poem_id: quote.relatedPoemId,
          related_poet_name: quote.cachedRelatedPoemPoetName,
          related_poem_title: quote.cachedRelatedPoemFullTitle,
          related_poem_url: quote.cachedRelatedPoemFullUrl,
          is_prior: quote.isPriorToRelated,
          quoted_couplet:
            quote.coupletVerse1 && quote.coupletVerse2
              ? `${quote.coupletVerse1} / ${quote.coupletVerse2}`
              : (quote.coupletVerse1 ?? quote.relatedCoupletVerse1),
          quoting_couplet:
            quote.relatedCoupletVerse1 && quote.relatedCoupletVerse2
              ? `${quote.relatedCoupletVerse1} / ${quote.relatedCoupletVerse2}`
              : (quote.relatedCoupletVerse1 ?? quote.coupletVerse1),
          claimed_by_both: quote.claimedByBothPoets,
          chosen_for_main_list: quote.chosenForMainList,
          note: quote.note,
        })),
      };

      return {
        data,
        markdown: () =>
          md(
            `# Poems quoting poem ${input.poem_id} (${list.length})`,
            "",
            bullets(
              list.map(
                (quote) =>
                  `${quote.cachedRelatedPoemPoetName ?? "unknown poet"} — ` +
                  `${quote.cachedRelatedPoemFullTitle ?? `poem ${quote.relatedPoemId}`} ` +
                  `(id \`${quote.relatedPoemId}\`)` +
                  (quote.cachedRelatedPoemFullUrl
                    ? ` · ${siteUrl(quote.cachedRelatedPoemFullUrl)}`
                    : ""),
              ),
              "no poems are recorded as quoting this poem",
            ),
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_poem_effective_corrections",
      title: "Get Poem Text Corrections",
      description: `Get the editorial corrections applied to a poem's text — the before/after record of every fix.

Useful for understanding why the text on Ganjoor differs from an older printed edition.

Args:
  - poem_id (number): Numeric poem id
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { poem_id, correction_count, corrections: [{ id, verse_order, text, original_text }] }

Examples:
  - "What corrections were made to poem 2623?" -> poem_id=2623

Notes:
  - Each entry pairs the corrected text with the original, per verse order.`,
      inputSchema: z
        .object({
          poem_id: IdSchema.describe("Numeric poem id."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as { poem_id: number };
      const corrections = await ganjoorGet<
        Array<{
          id: number;
          verseOrderText?: Array<{ id?: number; voRder?: number; text?: string; originalText?: string }>;
        }>
      >(`/api/ganjoor/poem/${input.poem_id}/corrections/effective`);

      const list = Array.isArray(corrections) ? corrections : [];
      const flat = list.flatMap((correction) =>
        (correction.verseOrderText ?? []).map((verse) => ({
          correction_id: correction.id,
          verse_id: verse.id ?? null,
          verse_order: verse.voRder ?? null,
          text: verse.text ?? null,
          original_text: verse.originalText ?? null,
        })),
      );

      const data = {
        poem_id: input.poem_id,
        correction_count: list.length,
        corrected_verse_count: flat.length,
        corrections: flat,
      };

      return {
        data,
        markdown: () =>
          md(
            `# Corrections applied to poem ${input.poem_id} (${flat.length} corrected verses)`,
            "",
            bullets(
              flat.map(
                (item) =>
                  `verse ${item.verse_order ?? "?"}: "${item.original_text ?? "—"}" → "${item.text ?? "—"}"`,
              ),
              "no corrections have been applied to this poem",
            ),
            "",
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_poem_geotags",
      title: "Get Poem Geo Tags",
      description: `Get the geographic and historical locations tagged to a single poem.

A geo tag pins a poem to a place and to the Hijri/Gregorian date it commemorates — for instance a
poem about a battle fought at a named site.

Args:
  - poem_id (number): Numeric poem id
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { poem_id, tag_count, tags: [{ id, latitude, longitude, lunar_date, gregorian_date }] }

Examples:
  - "Where is the event in poem 2623?" -> poem_id=2623

Notes:
  - For a whole diwan, use ganjoor_get_category_geotags instead.`,
      inputSchema: z
        .object({
          poem_id: IdSchema.describe("Numeric poem id."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as { poem_id: number };
      const tags = await ganjoorGet<
        Array<{
          id: number;
          latitude?: number | null;
          longitude?: number | null;
          lunarDate?: string | null;
          gregorianDate?: string | null;
        }>
      >(`/api/ganjoor/poem/${input.poem_id}/geotag`);

      const list = Array.isArray(tags) ? tags : [];

      const data = {
        poem_id: input.poem_id,
        tag_count: list.length,
        tags: list.map((tag) => ({
          id: tag.id,
          latitude: tag.latitude ?? null,
          longitude: tag.longitude ?? null,
          lunar_date: tag.lunarDate ?? null,
          gregorian_date: tag.gregorianDate ?? null,
        })),
      };

      return {
        data,
        markdown: () =>
          md(
            `# Geo tags for poem ${input.poem_id} (${list.length})`,
            "",
            bullets(
              list.map((tag) => {
                const coords =
                  tag.latitude !== null && tag.latitude !== undefined
                    ? `${tag.latitude}, ${tag.longitude}`
                    : "no coordinates";
                return `[${tag.lunarDate ?? "undated"} / ${tag.gregorianDate ?? "—"}] — ${coords}`;
              }),
              "this poem has no geo tags",
            ),
            "",
          ),
      };
    },
  );
}
