import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ganjoorGet, fetchPaged } from "../client.js";
import { IdSchema, PaginationSchema, ResponseFormatSchema, UrlSlugSchema } from "../schemas.js";
import { bullets, hijriToGregorianApprox, lines, md, num, siteUrl } from "../format.js";
import { defineTool, READ_ONLY } from "./registry.js";
import type {
  GanjoorBookViewModel,
  GanjoorCatViewModel,
  GanjoorCenturyViewModel,
  GanjoorPoetViewModel,
} from "../types.js";

/** Register poet-discovery tools. */
export function registerPoetTools(server: McpServer): void {
  defineTool(
    server,
    {
      name: "ganjoor_list_poets",
      title: "List Ganjoor Poets",
      description: `List all poets published on Ganjoor.net, including their biographies.

Returns one row per poet with: id, name, nickname, URL slug, root category id, birth/death years
(Hijri), and birth/death places. Use this first when you need to translate a poet's name to a
numeric id for other Ganjoor tools.

Args:
  - page (number): Page number, starting from 1 (default: 1)
  - page_size (number): Items per page, 1-100 (default: 20)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  A paginated poet list. For JSON: { total, count, page, page_size, has_more, next_page, poets: [{ id, name, nickname, full_url, root_cat_id, birth_year_hijri, death_year_hijri, birth_place, death_place }] }

Examples:
  - "Who is on Ganjoor?" -> page_size=50
  - "List the poets born in the 10th century Hijri" -> fetch pages and filter birth_year_hijri

Notes:
  - Only public, read-only data. No authentication required.
  - The list is long (~170 poets); paginate rather than requesting page_size=100 repeatedly.`,
      inputSchema: PaginationSchema.extend({ response_format: ResponseFormatSchema }).strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const { page, page_size } = args as unknown as { page: number; page_size: number };
      const result = await fetchPaged<GanjoorPoetViewModel>("/api/ganjoor/poets", page, page_size);

      const data = {
        total: result.items.length,
        count: result.items.length,
        page: result.page,
        page_size: result.page_size,
        has_more: result.has_more,
        next_page: result.next_page,
        poets: result.items.map((poet) => ({
          id: poet.id,
          name: poet.name,
          nickname: poet.nickname,
          full_url: poet.fullUrl,
          root_cat_id: poet.rootCatId,
          birth_year_hijri: poet.birthYearInLHijri,
          death_year_hijri: poet.deathYearInLHijri,
          birth_place: poet.birthPlace,
          death_place: poet.deathPlace,
        })),
      };

      return {
        data,
        markdown: () => {
          if (!result.items.length) {
            return "No poets found for this page. Use a lower page number.";
          }
          const head = md(
            `# Ganjoor poets (page ${result.page}, ${result.items.length} shown)`,
            result.has_more ? "More poets available — increase `page`." : "End of the poet list.",
          );
          const body = result.items.map((poet) => {
            const life = poet.birthYearInLHijri
              ? `${hijriToGregorianApprox(poet.birthYearInLHijri)}–${
                  poet.deathYearInLHijri
                    ? hijriToGregorianApprox(poet.deathYearInLHijri)
                    : "?"
                } CE`
              : "dates unknown";
            return md(
              `## ${poet.name} (id ${poet.id})`,
              `- **Slug**: \`${poet.fullUrl}\``,
              `- **Nickname**: ${poet.nickname ?? "—"}`,
              `- **Lived**: ${life}`,
              `- **Birth place**: ${poet.birthPlace ?? "—"} · **Death place**: ${poet.deathPlace ?? "—"}`,
              `- **Root category id**: ${poet.rootCatId}`,
              `- **Web**: ${siteUrl(poet.fullUrl)}`,
            );
          });
          return md(head, "", body.join("\n\n"));
        },
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_poet",
      title: "Get Ganjoor Poet",
      description: `Get a single poet's full profile (including biography) by numeric id or URL slug.

Use this to turn a slug like "/hafez" into the numeric poet id, or to read a poet's biography
and catalogue of works.

Args:
  - id (number): Numeric poet id (optional if \`url\` is given). Hafez = 2, Saadi = 7, Rumi = 5.
  - url (string): Poet URL slug such as 'hafez' or '/hafez' (optional if \`id\` is given)
  - include_cats (boolean): Include the poet's top-level book/section list (default: true)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Poet profile with id, name, nickname, biography, birth/death (Hijri + places), plus for JSON:
  { id, name, nickname, biography, birth_year_hijri, death_year_hijri, birth_place, death_place, full_url, cats: [{ id, title, full_url, cat_type }] }

Examples:
  - "Tell me about Hafez" -> url='hafez'
  - "What are Saadi's works?" -> id=7, include_cats=true

Notes:
  - Supply exactly one of \`id\` or \`url\`. If both are given, \`id\` wins.`,
      inputSchema: z
        .object({
          id: IdSchema.optional(),
          url: UrlSlugSchema.optional(),
          include_cats: z
            .boolean()
            .default(true)
            .describe("Include the poet's top-level list of books/sections."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as { id?: number; url?: string; include_cats: boolean };

      if (input.id === undefined && !input.url) {
        throw new Error(
          "Provide either `id` (numeric poet id) or `url` (poet slug). Use ganjoor_list_poets to look one up.",
        );
      }

      // `/api/ganjoor/poet` returns `{ poet, cat }` where `cat` is the poet's root
      // category; its `children` are the poet's top-level books and sections.
      let poet: GanjoorPoetViewModel;
      let rootCat: GanjoorCatViewModel | null = null;

      if (input.id !== undefined) {
        const detail = await ganjoorGet<{ poet: GanjoorPoetViewModel; cat?: GanjoorCatViewModel }>(
          `/api/ganjoor/poet/${input.id}`,
          { catPoems: false },
        );
        poet = detail.poet;
        rootCat = detail.cat ?? null;
      } else {
        const page = await ganjoorGet<{ poet: GanjoorPoetViewModel; cat?: GanjoorCatViewModel }>(
          "/api/ganjoor/poet",
          { url: input.url! },
        );
        poet = page.poet;
        rootCat = page.cat ?? null;
      }

      const cats = input.include_cats ? rootCat?.children ?? [] : [];
      const bio = poet.description ?? null;

      const data = {
        id: poet.id,
        name: poet.name,
        nickname: poet.nickname,
        biography: bio,
        full_url: poet.fullUrl,
        root_cat_id: poet.rootCatId ?? rootCat?.id ?? null,
        birth_year_hijri: poet.birthYearInLHijri,
        death_year_hijri: poet.deathYearInLHijri,
        birth_place: poet.birthPlace,
        death_place: poet.deathPlace,
        ...(input.include_cats
          ? {
              cats: cats.map((cat) => ({
                id: cat.id,
                title: cat.title,
                full_url: cat.fullUrl,
                cat_type: cat.catType,
              })),
            }
          : {}),
      };

      return {
        data,
        markdown: () => {
          const head = lines(
            `# ${poet.name}${
              poet.nickname && poet.nickname !== poet.name ? ` (${poet.nickname})` : ""
            } — poet id ${poet.id}`,
            `- **Web**: ${siteUrl(poet.fullUrl) ?? "—"}`,
            `- **Born**: ${
              poet.birthYearInLHijri
                ? `${poet.birthYearInLHijri} AH (≈ ${hijriToGregorianApprox(poet.birthYearInLHijri)} CE)${
                    poet.birthPlace ? ` in ${poet.birthPlace}` : ""
                  }`
                : "unknown"
            }`,
            `- **Died**: ${
              poet.deathYearInLHijri
                ? `${poet.deathYearInLHijri} AH (≈ ${hijriToGregorianApprox(poet.deathYearInLHijri)} CE)${
                    poet.deathPlace ? ` in ${poet.deathPlace}` : ""
                  }`
                : "unknown"
            }`,
          );
          const bioBlock = bio ? md("## Biography", "", bio) : null;
          const catList = input.include_cats
            ? md(
                "## Books and sections",
                "",
                cats.length
                  ? bullets(
                      cats.map(
                        (cat) =>
                          `${cat.title} — category id \`${cat.id}\` (type ${cat.catType}: ${
                            cat.catType === 2 ? "book" : cat.catType === 1 ? "poems" : "general"
                          }) · ${siteUrl(cat.fullUrl)}`,
                      ),
                    )
                  : "This poet has no published books or sections yet. Use ganjoor_search_poems with poet_id to find their poems.",
              )
            : null;
          return md(...head, "", bioBlock, catList);
        },
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_poets_by_century",
      title: "Get Ganjoor Poets By Century",
      description: `Get every Ganjoor poet grouped into historical half-centuries.

The first group (id 0) holds the "pinned"/featured poets shown on the Ganjoor home page. Each later
group carries a name, an approximate Gregorian year range, and the poets active in that period.

Args:
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { centuries: [{ id, name, start_year, end_year, poet_count, poets: [{ id, name, full_url }] }] }

Examples:
  - "Which poets are from the 14th century?" -> inspect the century entries and their poets

Notes:
  - The whole payload is returned at once; it is a few hundred KB at most.
  - Grouping is editorial, so a poet appears exactly once.`,
      inputSchema: z.object({ response_format: ResponseFormatSchema }).strict(),
      annotations: READ_ONLY,
    },
    async () => {
      const centuries = await ganjoorGet<GanjoorCenturyViewModel[]>("/api/ganjoor/centuries");

      const data = {
        centuries: centuries.map((century) => ({
          id: century.id,
          name: century.name || "Featured / pinned poets",
          start_year: century.startYear || null,
          end_year: century.endYear || null,
          poet_count: (century.poets ?? []).length,
          poets: (century.poets ?? []).map((poet) => ({
            id: poet.id,
            name: poet.name,
            full_url: poet.fullUrl,
          })),
        })),
      };

      return {
        data,
        markdown: () => {
          const blocks = centuries.map((century) => {
            const label = century.name || "Featured / pinned";
            const range =
              century.startYear || century.endYear
                ? ` (${num(century.startYear)}–${num(century.endYear)} CE)`
                : "";
            return md(
              `## ${label}${range} — ${(century.poets ?? []).length} poets`,
              "",
              bullets(
                (century.poets ?? []).map(
                  (poet) => `${poet.name} (id \`${poet.id}\`) — ${siteUrl(poet.fullUrl)}`,
                ),
                "no poets in this group",
              ),
            );
          });
          return md(
            `# Ganjoor poets by century (${centuries.length} groups)`,
            "",
            blocks.join("\n\n"),
          );
        },
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_list_books",
      title: "List Ganjoor Books",
      description: `List Ganjoor books (named collections such as دیوان حافظ or غزلیات سعدی), alphabetically.

Every returned entry is a category of type "Book". Use the resulting category id with
ganjoor_get_category to browse the poems inside, or with ganjoor_get_category_poems to list them.

Args:
  - name (string): Optional filter — only books whose name contains this substring (case-insensitive)
  - poet_id (number): Optional filter — only books belonging to this poet id
  - page (number): Page number, starting from 1 (default: 1)
  - page_size (number): Items per page, 1-100 (default: 20)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { count, page, page_size, has_more, next_page, books: [{ id, name, poet_id, poet_name, full_url }] }

Examples:
  - "What books does Hafez have?" -> poet_id=2
  - "Find books matching 'ghazal'" -> name='ghazal'
  - "Show me Molavi's collections" -> poet_id=5

Notes:
  - Filtering happens server-side, so it is much cheaper than fetching everything and filtering locally.
  - Ganjoor's book catalog is a curated subset: some major poets (including Hafez) have no entries.
    For them use ganjoor_get_poet with include_cats=true, which lists a poet's sections directly.`,
      inputSchema: z
        .object({
          name: z
            .string()
            .trim()
            .max(200)
            .optional()
            .describe("Case-insensitive substring filter on the book name, e.g. 'ghazal' or 'divan'."),
          poet_id: z
            .number()
            .int()
            .min(0)
            .default(0)
            .describe("Only books belonging to this poet id. 0 disables the filter."),
          page: PaginationSchema.shape.page,
          page_size: PaginationSchema.shape.page_size,
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as {
        name?: string;
        poet_id: number;
        page: number;
        page_size: number;
      };

      // This endpoint is not paged upstream, so paginate client-side.
      const all = await ganjoorGet<GanjoorBookViewModel[]>("/api/ganjoor/book-catalog", {
        name: input.name,
        poetId: input.poet_id > 0 ? input.poet_id : undefined,
      });

      const start = (input.page - 1) * input.page_size;
      const items = all.slice(start, start + input.page_size);
      const hasMore = start + items.length < all.length;

      const data = {
        total: all.length,
        count: items.length,
        page: input.page,
        page_size: input.page_size,
        has_more: hasMore,
        next_page: hasMore ? input.page + 1 : null,
        books: items.map((book) => ({
          id: book.id,
          name: book.name,
          poet_id: book.poetId,
          poet_name: book.poetName,
          full_url: book.fullUrl,
        })),
      };

      return {
        data,
        markdown: () =>
          md(
            `# Ganjoor books (${all.length} matching, showing ${items.length})`,
            hasMore ? "More results available — increase `page`." : null,
            "",
            bullets(
              items.map(
                (book) =>
                  `${book.name} — ${book.poetName}, category id \`${book.id}\` · ${siteUrl(book.fullUrl)}`,
              ),
              // The upstream catalog is a curated subset and omits some major poets
              // (notably Hafez), so an empty result needs an alternative route.
              input.poet_id
                ? `No books are listed for poet id ${input.poet_id} in Ganjoor's book catalog. That catalog is curated and does not cover every poet — use ganjoor_get_poet with poet_id=${input.poet_id} (include_cats=true) to list this poet's books and sections instead.`
                : "no books matched this name filter — try a shorter substring, or omit `name`",
            ),
          ),
      };
    },
  );
}

