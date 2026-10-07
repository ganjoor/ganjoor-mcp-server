import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ganjoorGet, fetchPaged } from "../client.js";
import { IdSchema, PaginationSchema, ResponseFormatSchema } from "../schemas.js";
import { bullets, md, num, siteUrl } from "../format.js";
import { defineTool, READ_ONLY } from "./registry.js";
import type {
  GanjooRhymeAnalysisResult,
  GanjoorMetre,
  GanjoorRelatedSection,
  GanjoorSection,
  GanjoorVerse,
} from "../types.js";

/** Register prosody, rhyme, and section-structure tools. */
export function registerAnalysisTools(server: McpServer): void {
  defineTool(
    server,
    {
      name: "ganjoor_list_rhythms",
      title: "List Ganjoor Metres (Rhythms)",
      description: `List every Persian prosodic metre (وزن) used in the Ganjoor corpus, with its verse-pattern notation.

Use this to translate a metre name into the id Ganjoor uses, or to discover the metre vocabulary
before calling ganjoor_find_similar_poems or ganjoor_analyze_poem_rhythm.

Args:
  - page (number): Page number, starting from 1 (default: 1)
  - page_size (number): Items per page, 1-100 (default: 50)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { count, page, page_size, has_more, next_page, rhythms: [{ id, rhythm, verse_count }] }

Examples:
  - "What metres exist?" -> no arguments
  - "Find the metre 'فاعلاتن'" -> page through results looking for the pattern

Notes:
  - \`rhythm\` is the classical Persian scansion pattern; \`verse_count\` is how many Ganjoor poems use it.
  - There are roughly 50-70 metres; one page of 100 usually covers everything.`,
      inputSchema: PaginationSchema.extend({ response_format: ResponseFormatSchema }).strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const { page, page_size } = args as unknown as { page: number; page_size: number };
      const list = await fetchPaged<GanjoorMetre>("/api/ganjoor/rhythms", page, page_size);

      const data = {
        count: list.items.length,
        page: list.page,
        page_size: list.page_size,
        has_more: list.has_more,
        next_page: list.next_page,
        rhythms: list.items.map((metre) => ({
          id: metre.id,
          rhythm: metre.rhythm,
          verse_count: metre.verseCount,
        })),
      };

      return {
        data,
        markdown: () =>
          md(
            `# Ganjoor metres (${list.items.length} shown, page ${list.page})`,
            list.has_more ? "More — increase `page`." : "End of the metre list.",
            "",
            bullets(
              list.items.map((metre) => `${metre.rhythm} — id \`${metre.id}\`, ${num(metre.verseCount)} poems`),
              "no metres returned",
            ),
            "",
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_analyze_poem_rhythm",
      title: "Analyze Poem Rhythm (Metre)",
      description: `Detect the prosodic metre (وزن) of a poem by its numeric id.

Runs Ganjoor's prosody engine over the poem's verses and returns the matched metre together with
its confidence and the competing alternatives considered.

Args:
  - poem_id (number): Numeric poem id
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { poem_id, metre: { id, rhythm }, confidence, alternatives: [{ id, rhythm, score }] }

Examples:
  - "What metre is poem 2623 in?" -> poem_id=2623

Notes:
  - The detected metre may differ from the poem's stored metre for edited or composite texts.`,
      inputSchema: z
        .object({
          poem_id: IdSchema.describe("Numeric poem id to analyze."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as { poem_id: number };
      const result = await ganjoorGet<{
        metreRhythm?: string;
        metreId?: number;
        bestCandidate?: string;
        secondBestCandidate?: string;
        thirdBestCandidate?: string;
        score?: number;
      }>(`/api/ganjoor/poem/analysisrhythm/${input.poem_id}`);

      const rhythm = result?.metreRhythm ?? result?.bestCandidate ?? null;

      const data = {
        poem_id: input.poem_id,
        metre: rhythm ? { id: result?.metreId ?? null, rhythm } : null,
        best_candidate: result?.bestCandidate ?? null,
        second_best_candidate: result?.secondBestCandidate ?? null,
        third_best_candidate: result?.thirdBestCandidate ?? null,
        score: result?.score ?? null,
      };

      return {
        data,
        markdown: () =>
          md(
            `# Rhythm analysis — poem ${input.poem_id}`,
            `- **Metre**: ${rhythm ?? "not detected"}`,
            result?.bestCandidate ? `- **Best candidate**: ${result.bestCandidate}` : null,
            result?.secondBestCandidate ? `- **Runner-up**: ${result.secondBestCandidate}` : null,
            result?.score !== undefined && result?.score !== null
              ? `- **Score**: ${result.score}`
              : null,
            "",
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_analyze_poem_rhyme",
      title: "Analyze Poem Rhyme",
      description: `Detect the rhyme letter (قافیه) and rhyme pattern of a poem by its numeric id.

Args:
  - poem_id (number): Numeric poem id
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { poem_id, rhyme, rhyme_letter, fail_verse } — \`rhyme\` is the full rhyming ending as the
  prosody engine sees it, and \`rhyme_letter\` is its last character.

Examples:
  - "What is the rhyme of poem 2623?" -> poem_id=2623

Notes:
  - Some poems (short texts, composite editions) have no determinable rhyme; those return
    rhyme=null plus a fail_verse note explaining where analysis stopped.`,
      inputSchema: z
        .object({
          poem_id: IdSchema.describe("Numeric poem id to analyze."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as { poem_id: number };
      // The endpoint returns { rhyme, failVerse } — but on failure it returns a bare
      // JSON string such as "no sections", so accept both shapes.
      const raw = await ganjoorGet<GanjooRhymeAnalysisResult | string>(
        `/api/ganjoor/poem/analysisrhyme/${input.poem_id}`,
      );

      const result: GanjooRhymeAnalysisResult =
        typeof raw === "string" ? { rhyme: null, failVerse: raw } : (raw ?? { rhyme: null, failVerse: null });

      // `rhyme` is the full rhyming ending (e.g. "انباری"); its last character is the rhyme letter.
      const rhyme = result.rhyme ?? null;
      const rhymeLetter = rhyme ? rhyme.slice(-1) : null;

      const data = {
        poem_id: input.poem_id,
        rhyme,
        rhyme_letter: rhymeLetter,
        fail_verse: result.failVerse ?? null,
      };

      return {
        data,
        markdown: () =>
          md(
            `# Rhyme analysis — poem ${input.poem_id}`,
            rhyme ? `- **Rhyme**: ${rhyme}` : null,
            rhymeLetter ? `- **Rhyme letter**: ${rhymeLetter}` : null,
            result.failVerse ? `- **Note**: ${result.failVerse}` : null,
            rhyme ? null : "- No rhyme could be determined for this poem.",
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_find_similar_poems",
      title: "Find Similar Poems By Metre And Rhyme",
      description: `Find poems that share a poem's prosodic metre and rhyme letter — the basis of Ganjoor's "related poems" (شعرهای مرتبط) pages.

Two Persian poems matching in metre and rhyme can be read as answers to each other (reply-poetry),
so this is also how you trace how one poet answered another.

Args:
  - metre (string): The prosodic metre pattern, exactly as listed by ganjoor_list_rhythms
  - rhyme (string): Optional rhyme letter filter (e.g. 'ا', 'ب'). Empty means any.
  - poet_id (number): Restrict to a poet id. 0 = all poets (default: 0)
  - cat_id (number): Restrict to a category id. 0 = all categories (default: 0)
  - couplet_count_min (number): Only poems with at least this many couplets (default: 0)
  - couplet_count_max (number): Only poems with at most this many couplets (default: 0, meaning no cap)
  - page (number): Page number, starting from 1 (default: 1)
  - page_size (number): Results per page, 1-100 (default: 20)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { count, page, page_size, has_more, next_page, poems: [{ id, title, full_title, full_url, plain_text }] }

Examples:
  - "Which Hafez poems share metre 'فاعلاتن مفاعلن فعلن'?" -> metre='فاعلاتن مفاعلن فعلن', poet_id=2
  - "Poems in metre X rhyming on ب" -> metre='...', rhyme='ب'

Notes:
  - \`metre\` must match the metre notation exactly; call ganjoor_list_rhythms to get valid values.
  - A metre with no rhyme filter returns a very large set — always page.`,
      inputSchema: z
        .object({
          metre: z
            .string()
            .trim()
            .min(1, "Metre is required")
            .max(100)
            .describe(
              "Prosodic metre pattern exactly as returned by ganjoor_list_rhythms, e.g. 'فاعلاتن مفاعلن فعلن'.",
            ),
          rhyme: z
            .string()
            .trim()
            .max(20)
            .default("")
            .describe("Optional rhyme letter, e.g. 'ا' or 'ب'. Empty matches any rhyme."),
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
          couplet_count_min: z
            .number()
            .int()
            .min(0)
            .default(0)
            .describe("Only poems with at least this many couplets. 0 disables the filter."),
          couplet_count_max: z
            .number()
            .int()
            .min(0)
            .default(0)
            .describe("Only poems with at most this many couplets. 0 disables the filter."),
          page: PaginationSchema.shape.page,
          page_size: PaginationSchema.shape.page_size,
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as {
        metre: string;
        rhyme: string;
        poet_id: number;
        cat_id: number;
        couplet_count_min: number;
        couplet_count_max: number;
        page: number;
        page_size: number;
      };

      const list = await fetchPaged<{
        id: number;
        title: string;
        fullTitle: string;
        fullUrl: string;
        plainText?: string;
      }>("/api/ganjoor/poems/similar", input.page, input.page_size, {
        metre: input.metre,
        rhyme: input.rhyme || undefined,
        poetId: input.poet_id > 0 ? input.poet_id : undefined,
        catId: input.cat_id > 0 ? input.cat_id : undefined,
        coupletCountsFrom: input.couplet_count_min || undefined,
        coupletCountsTo: input.couplet_count_max || undefined,
      });

      const poems = list.items.map((poem) => ({
        id: poem.id,
        title: poem.title,
        full_title: poem.fullTitle,
        full_url: poem.fullUrl,
        plain_text: poem.plainText ?? null,
      }));

      const data = {
        metre: input.metre,
        rhyme: input.rhyme || null,
        count: poems.length,
        page: list.page,
        page_size: list.page_size,
        has_more: list.has_more,
        next_page: list.next_page,
        poems,
      };

      return {
        data,
        markdown: () =>
          md(
            `# Poems in metre "${input.metre}"${input.rhyme ? `, rhyme "${input.rhyme}"` : ""}`,
            `${poems.length} shown (page ${list.page})${list.has_more ? " — more available" : ""}`,
            "",
            bullets(
              poems.map((poem) => `${poem.full_title} — id \`${poem.id}\` · ${siteUrl(poem.full_url)}`),
              "no poems matched this metre and rhyme",
            ),
            "",
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_poem_sections",
      title: "Get Poem Sections",
      description: `Get the structural sections of a poem — the stanzas (بند), couplets (مثنوی), and tercets (رباعی) it is built from.

Ganjoor models a poem as nested sections so that poetry written in distinct forms within one poem
(e.g. a ghazal that closes with a qet'e) can be analysed per-section.

Args:
  - poem_id (number): Numeric poem id
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { poem_id, section_count, sections: [{ id, index, number, section_type, verse_type, metre, rhyme }] }

Examples:
  - "What is the structure of poem 2623?" -> poem_id=2623

Notes:
  - Section \`index\` values feed directly into ganjoor_get_related_sections.`,
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
      const sections = await ganjoorGet<GanjoorSection[]>(
        `/api/ganjoor/sections/${input.poem_id}`,
      );
      const list = Array.isArray(sections) ? sections : [];

      const data = {
        poem_id: input.poem_id,
        section_count: list.length,
        sections: list.map((section) => ({
          id: section.id,
          index: section.index,
          number: section.number,
          section_type: section.sectionType,
          verse_type: section.verseType,
          metre: section.ganjoorMetre?.rhythm ?? null,
          rhyme: section.rhymeLetters ?? null,
        })),
      };

      return {
        data,
        markdown: () =>
          md(
            `# Sections of poem ${input.poem_id} (${list.length})`,
            "",
            bullets(
              list.map(
                (section) =>
                  `index \`${section.index}\` #${section.number} — type ${section.sectionType}, metre ${
                    section.ganjoorMetre?.rhythm ?? "—"
                  }, rhyme ${section.rhymeLetters ?? "—"}`,
              ),
              "no sections found",
            ),
            "",
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_section",
      title: "Get Poem Section",
      description: `Get one section of a poem by its section id, including its verses and its own related sections.

Args:
  - section_id (number): Section id — get these from ganjoor_get_poem_sections
  - include_verses (boolean): Include the section's verses (default: true)
  - include_related (boolean): Include related sections from other poems (default: false)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Section metadata, its metre/rhyme, optionally its verses and its related sections.

Examples:
  - "Show me section 38101" -> section_id=38101

Notes:
  - A section id differs from a poem id; use ganjoor_get_poem_sections first to map between them.`,
      inputSchema: z
        .object({
          section_id: IdSchema.describe("Section id from ganjoor_get_poem_sections."),
          include_verses: z.boolean().default(true).describe("Include the section's verses."),
          include_related: z
            .boolean()
            .default(false)
            .describe("Include sections from other poems related to this one."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as {
        section_id: number;
        include_verses: boolean;
        include_related: boolean;
      };

      const section = await ganjoorGet<GanjoorSection>(
        `/api/ganjoor/section/${input.section_id}`,
        { includeVerses: input.include_verses, includeRelated: input.include_related },
      );

      const verses = section.verses ?? [];
      const related = section.relatedSections ?? [];

      const data: Record<string, unknown> = {
        id: section.id,
        poem_id: section.poemId,
        section_index: section.index,
        number: section.number,
        section_type: section.sectionType,
        verse_type: section.verseType,
        metre: section.ganjoorMetre?.rhythm ?? null,
        metre_id: section.ganjoorMetreId ?? null,
        rhyme: section.rhymeLetters ?? null,
        ...(input.include_verses
          ? {
              verse_count: verses.length,
              verses: verses.map((verse) => ({
                id: verse.id,
                position: verse.versePosition,
                text: verse.text,
              })),
            }
          : {}),
        ...(input.include_related
          ? {
              related_count: related.length,
              related_sections: related.map((item) => ({
                id: item.id,
                poem_id: item.poemId,
                section_index: item.sectionIndex,
                poet_name: item.poetName,
                full_url: item.fullUrl,
              })),
            }
          : {}),
      };

      return {
        data,
        markdown: () =>
          md(
            `# Section ${section.id} (poem ${section.poemId}, index ${section.index})`,
            `- **Metre**: ${section.ganjoorMetre?.rhythm ?? "—"}`,
            `- **Rhyme**: ${section.rhymeLetters ?? "—"}`,
            "",
            ...(input.include_verses
              ? ["## Verses", "", ...verses.map((verse) => `[${verse.versePosition + 1}] ${verse.text}`), ""]
              : []),
            ...(input.include_related && related.length
              ? [
                  "## Related sections",
                  "",
                  bullets(
                    related.map(
                      (item) =>
                        `${item.poetName ?? "unknown poet"} — poem ${item.poemId}, section ${item.sectionIndex}${
                          item.fullUrl ? ` · ${siteUrl(item.fullUrl)}` : ""
                        }`,
                    ),
                  ),
                  "",
                ]
              : []),
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_related_sections",
      title: "Get Related Poem Sections",
      description: `Find sections from other poems that match a given poem section in metre and rhyme.

This is the section-level counterpart of ganjoor_find_similar_poems and is how Ganjoor links
reply-poems and cross-poet allusions at stanza granularity.

Args:
  - poem_id (number): Numeric poem id
  - section_index (number): 0-based section index within the poem (from ganjoor_get_poem_sections)
  - skip (number): Results to skip (default: 0)
  - items_count (number): How many to return. 0 or negative returns all (default: 10)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { poem_id, section_index, total, related_sections: [{ id, poem_id, section_index, poet_name, full_url }] }

Examples:
  - "What matches the first section of poem 2623?" -> poem_id=2623, section_index=0

Notes:
  - \`items_count=0\` returns every match, which can be thousands — prefer a bounded count.`,
      inputSchema: z
        .object({
          poem_id: IdSchema.describe("Numeric poem id."),
          section_index: z
            .number()
            .int()
            .min(0)
            .describe("0-based section index within the poem."),
          skip: z.number().int().min(0).default(0).describe("Results to skip for pagination."),
          items_count: z
            .number()
            .int()
            .default(10)
            .describe("How many related sections to return. 0 or less returns all."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as {
        poem_id: number;
        section_index: number;
        skip: number;
        items_count: number;
      };

      const all = await ganjoorGet<GanjoorRelatedSection[]>(
        `/api/ganjoor/section/${input.poem_id}/${input.section_index}/related`,
        { skip: 0, itemsCount: 0 },
      );

      const list = Array.isArray(all) ? all : [];
      const items = list.slice(input.skip, input.skip + Math.max(0, input.items_count));

      const data = {
        poem_id: input.poem_id,
        section_index: input.section_index,
        total: list.length,
        skip: input.skip,
        returned: items.length,
        related_sections: items.map((item) => ({
          id: item.id,
          poem_id: item.poemId,
          section_index: item.sectionIndex,
          poet_name: item.poetName,
          full_url: item.fullUrl,
        })),
      };

      return {
        data,
        markdown: () =>
          md(
            `# Related sections — poem ${input.poem_id}, section ${input.section_index}`,
            `${items.length} of ${list.length} shown`,
            "",
            bullets(
              items.map(
                (item) =>
                  `${item.poetName ?? "unknown poet"} — poem ${item.poemId}, section ${item.sectionIndex}${
                    item.fullUrl ? ` · ${siteUrl(item.fullUrl)}` : ""
                  }`,
              ),
              "no related sections found",
            ),
            "",
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_couplet_sections",
      title: "Get Sections For A Couplet",
      description: `Find which structural sections a specific couplet of a poem belongs to.

A verse carries up to four nested section indices; this endpoint resolves one couplet to the
stanzas that contain it, which you need when analysing a ghazal's opening or closing section.

Args:
  - poem_id (number): Numeric poem id
  - couplet_index (number): 0-based couplet number
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { poem_id, couplet_index, sections: [{ id, index, number, section_type, metre, rhyme }] }

Examples:
  - "Which section is couplet 5 of poem 2623 in?" -> poem_id=2623, couplet_index=5

Notes:
  - An empty list means the couplet index is out of range for that poem.`,
      inputSchema: z
        .object({
          poem_id: IdSchema.describe("Numeric poem id."),
          couplet_index: z
            .number()
            .int()
            .min(0)
            .describe("0-based couplet number."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as { poem_id: number; couplet_index: number };
      const sections = await ganjoorGet<GanjoorSection[]>(
        `/api/ganjoor/couplet/${input.poem_id}/${input.couplet_index}/sections`,
      );
      const list = Array.isArray(sections) ? sections : [];

      const data = {
        poem_id: input.poem_id,
        couplet_index: input.couplet_index,
        sections: list.map((section) => ({
          id: section.id,
          index: section.index,
          number: section.number,
          section_type: section.sectionType,
          metre: section.ganjoorMetre?.rhythm ?? null,
          rhyme: section.rhymeLetters ?? null,
        })),
      };

      return {
        data,
        markdown: () =>
          md(
            `# Sections containing poem ${input.poem_id}, couplet ${input.couplet_index}`,
            "",
            bullets(
              list.map(
                (section) =>
                  `index \`${section.index}\` #${section.number} — metre ${
                    section.ganjoorMetre?.rhythm ?? "—"
                  }, rhyme ${section.rhymeLetters ?? "—"}`,
              ),
              "no sections matched this couplet — check the couplet index",
            ),
            "",
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_language_tagged_sections",
      title: "Get Language-Tagged Poem Sections",
      description: `List poem sections Ganjoor has tagged with a specific language, newest-scoped by poet.

Ganjoor tags translated or bilingual stanzas with a language code (for example \`ar\` for Arabic
quoted lines, or \`en\` for English ones). This finds those passages across the corpus.

Args:
  - language (string): Language code, e.g. 'ar' for Arabic, 'en' for English, 'fa-IR' for Persian
  - poet_id (number): Restrict to a poet id. 0 = all poets (default: 0)
  - page (number): Page number, starting from 1 (default: 1)
  - page_size (number): Items per page, 1-100 (default: 20)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { language, count, page, page_size, has_more, next_page, sections: [{ id, poem_id, poem_title, poet_name }] }

Examples:
  - "Which passages quote Arabic?" -> language='ar'
  - "Arabic stanzas in Hafez" -> language='ar', poet_id=2

Notes:
  - Coverage is patchy: most Persian stanzas are untagged, so an empty result does not mean no
    such passage exists.`,
      inputSchema: z
        .object({
          language: z
            .string()
            .trim()
            .min(1)
            .max(20)
            .describe("Language code to filter by, e.g. 'ar', 'en', 'fa-IR'."),
          poet_id: z
            .number()
            .int()
            .min(0)
            .default(0)
            .describe("Restrict to a poet id. 0 = all poets."),
          page: PaginationSchema.shape.page,
          page_size: PaginationSchema.shape.page_size,
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as { language: string; poet_id: number; page: number; page_size: number };
      const list = await fetchPaged<{
        id: number;
        poemId: number;
        poemTitle?: string;
        poetName?: string;
        sectionIndex?: number;
      }>("/api/ganjoor/sections/tagged/language", input.page, input.page_size, {
        language: input.language,
        poetId: input.poet_id > 0 ? input.poet_id : undefined,
      });

      const data = {
        language: input.language,
        count: list.items.length,
        page: list.page,
        page_size: list.page_size,
        has_more: list.has_more,
        next_page: list.next_page,
        sections: list.items.map((item) => ({
          id: item.id,
          poem_id: item.poemId,
          poem_title: item.poemTitle ?? null,
          poet_name: item.poetName ?? null,
          section_index: item.sectionIndex ?? null,
        })),
      };

      return {
        data,
        markdown: () =>
          md(
            `# Sections tagged "${input.language}" (${list.items.length} shown, page ${list.page})`,
            list.has_more ? "More — increase `page`." : null,
            "",
            bullets(
              list.items.map(
                (item) =>
                  `${item.poemTitle ?? `poem ${item.poemId}`}${
                    item.poetName ? ` — ${item.poetName}` : ""
                  } (section id \`${item.id}\`)`,
              ),
              "no sections tagged with this language",
            ),
            "",
          ),
      };
    },
  );
}

/** Re-exported so other tool modules can share the verse shape. */
export type { GanjoorVerse };
