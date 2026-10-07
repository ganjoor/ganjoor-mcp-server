import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ganjoorGet, type QueryValue } from "../client.js";
import { IdSchema, PaginationSchema, ResponseFormatSchema } from "../schemas.js";
import { bullets, lines, md, siteUrl } from "../format.js";
import { defineTool, READ_ONLY } from "./registry.js";
import type { GanjoorCatViewModel, GanjoorGeoTag } from "../types.js";

const CAT_TYPE_LABEL: Record<number, string> = {
  0: "general",
  1: "poems",
  2: "book",
};

/** Render a category breadcrumb path such as "حافظ » غزلیات". */
function breadcrumb(cat: GanjoorCatViewModel): string {
  const ancestors = (cat.ancestors ?? []).map((a) => a.title);
  return [...ancestors, cat.title].join(" » ");
}

/**
 * `GET /api/ganjoor/cat/{id}` wraps the record as `{ poet, cat }`.
 * Accept either shape so the helper works if upstream ever flattens it.
 */
async function fetchCategory(id: number, params: Record<string, QueryValue>): Promise<GanjoorCatViewModel> {
  const response = await ganjoorGet<{ cat?: GanjoorCatViewModel } & Partial<GanjoorCatViewModel>>(
    `/api/ganjoor/cat/${id}`,
    params,
  );
  const cat = response?.cat ?? (response as GanjoorCatViewModel);
  if (!cat || typeof cat.id !== "number") {
    throw new Error(
      `Error: category ${id} returned an unexpected payload. Verify the id with ganjoor_list_books or ganjoor_get_poet.`,
    );
  }
  return cat;
}

/**
 * Compose a poem's web path from its category and the poem's urlSlug.
 *
 * Rows inside a category's `poems` array carry only `urlSlug`, so the parent
 * category's path has to be prepended to build a clickable link.
 */
function poemPath(category: GanjoorCatViewModel, poemUrlSlug: string): string {
  const base = String(category.fullUrl ?? "").replace(/\/+$/, "");
  return `${base}/${poemUrlSlug}`.replace(/\/+/g, "/");
}

function catSummary(cat: GanjoorCatViewModel) {
  return {
    id: cat.id,
    title: cat.title,
    full_url: cat.fullUrl,
    cat_type: cat.catType,
    cat_type_label: CAT_TYPE_LABEL[cat.catType] ?? `type ${cat.catType}`,
    parent_id: cat.ancestors?.[cat.ancestors.length - 1]?.id ?? null,
    child_count: (cat.children ?? []).length,
    poem_count: cat.poems?.length ?? null,
    description: cat.description ?? null,
  };
}

/** Register category browsing tools. */
export function registerCategoryTools(server: McpServer): void {
  defineTool(
    server,
    {
      name: "ganjoor_get_category",
      title: "Get Ganjoor Category",
      description: `Get a Ganjoor category (a book, section, or sub-collection) by numeric id.

A category is the container for poems inside a poet's work — for example Hafez's ghazals
(category id 10) or Rumi's Masnavi. The response includes the breadcrumb path, the direct
children (sub-sections), and optionally the poems it contains.

Args:
  - cat_id (number): Category id. Hafez's root category is 9.
  - include_poems (boolean): Include the poems inside this category (default: true)
  - include_children (boolean): Include the direct child categories/sections (default: true)
  - poem_limit (number): Maximum poems to return when include_poems is true, 1-200 (default: 50)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Category metadata: id, title, breadcrumb, description, table-of-contents style, child categories,
  and (optionally) contained poems with their ids, titles and URLs. Set include_poems=false to skip
  the poem list; use ganjoor_list_category_poems when you only want the poems and their total count.

Examples:
  - "What is inside Hafez's ghazals?" -> cat_id=10, include_children=false
  - "List Hafez's sections" -> cat_id=9, include_poems=false

Notes:
  - A category that directly contains poems returns those poems; a pure section returns children
    instead. Follow \`children\` to descend.`,
      inputSchema: z
        .object({
          cat_id: IdSchema.describe(
            "Category id. Hafez's root category is 9; use ganjoor_list_books or ganjoor_get_poet to discover others.",
          ),
          include_poems: z
            .boolean()
            .default(true)
            .describe("Include the poems contained directly in this category."),
          include_children: z
            .boolean()
            .default(true)
            .describe("Include the direct child categories."),
          poem_limit: z
            .number()
            .int()
            .min(1)
            .max(200)
            .default(50)
            .describe("Maximum poems to include when include_poems is true."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as {
        cat_id: number;
        include_poems: boolean;
        include_children: boolean;
        poem_limit: number;
      };

      const cat = await fetchCategory(input.cat_id, {
        poems: input.include_poems,
        mainSections: input.include_children,
      });

      const poems = (cat.poems ?? []).slice(0, input.poem_limit);
      const children = cat.children ?? [];

      const data = {
        ...catSummary(cat),
        breadcrumb: breadcrumb(cat),
        table_of_contents_style: cat.tableOfContentsStyle,
        // Always report the count so callers can compare collections without
        // paying for the poem list itself.
        poem_count: input.include_poems ? (cat.poems ?? []).length : null,
        ...(input.include_children
          ? {
              children: children.map((child) => ({
                id: child.id,
                title: child.title,
                full_url: child.fullUrl,
                cat_type: child.catType,
              })),
            }
          : {}),
        ...(input.include_poems
          ? {
              poems: poems.map((poem) => ({
                id: poem.id,
                title: poem.title,
                full_url: poemPath(cat, poem.urlSlug),
                excerpt: poem.excerpt ?? null,
              })),
              poems_total: (cat.poems ?? []).length,
            }
          : {}),
      };

      return {
        data,
        markdown: () => {
          const head = lines(
            `# ${cat.title} (category id ${cat.id})`,
            `- **Path**: ${breadcrumb(cat)}`,
            `- **Type**: ${CAT_TYPE_LABEL[cat.catType] ?? cat.catType}`,
            `- **Web**: ${siteUrl(cat.fullUrl)}`,
            `- **Children**: ${children.length} · **Poems**: ${(cat.poems ?? []).length}`,
          );
          const desc = cat.descriptionHtml || cat.description;
          const descBlock = desc ? md("## Description", "", desc) : null;

          const childBlock = input.include_children
            ? md(
                "## Sub-sections",
                "",
                bullets(
                  children.map((child) => `${child.title} — id \`${child.id}\` · ${siteUrl(child.fullUrl)}`),
                  "this category has no sub-sections",
                ),
              )
            : null;

          const poemBlock = input.include_poems
            ? md(
                `## Poems in this category (${poems.length} of ${(cat.poems ?? []).length})`,
                "",
                bullets(
                  poems.map(
                    (poem) =>
                      `${poem.title} — id \`${poem.id}\` · ${siteUrl(poemPath(cat, poem.urlSlug))}`,
                  ),
                  "no poems directly in this category",
                ),
              )
            : null;

          return md(head.join("\n"), "", descBlock, childBlock, poemBlock);
        },
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_list_category_poems",
      title: "List Poems In A Ganjoor Category",
      description: `List the poems contained in a Ganjoor category, optionally filtered by the author's name.

Args:
  - cat_id (number): Category id to list poems from
  - title_contains (string): Optional filter — only poems whose title contains this text
  - page (number): Page number, starting from 1 (default: 1)
  - page_size (number): Poems per page, 1-100 (default: 20)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { total, count, page, page_size, has_more, next_page, category: { id, title, full_url }, poems: [{ id, title, url_slug, full_url, excerpt }] }

Examples:
  - "Which poems are in category 10?" -> cat_id=10
  - "Find the 'شمارهٔ ۱' poems in a category" -> title_contains='شمارهٔ ۱'

Notes:
  - Title filtering is done client-side because the upstream category endpoint is unpaged.
  - For large collections, combine this with page_size to walk the whole diwan.`,
      inputSchema: z
        .object({
          cat_id: IdSchema.describe("Category id to list poems from."),
          title_contains: z
            .string()
            .trim()
            .max(200)
            .optional()
            .describe("Optional case-insensitive substring filter applied to poem titles."),
          page: PaginationSchema.shape.page,
          page_size: PaginationSchema.shape.page_size,
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as {
        cat_id: number;
        title_contains?: string;
        page: number;
        page_size: number;
      };

      const cat = await fetchCategory(input.cat_id, {
        poems: true,
        mainSections: false,
      });

      let poems = cat.poems ?? [];
      if (input.title_contains) {
        const needle = input.title_contains.toLocaleLowerCase();
        poems = poems.filter((poem) => poem.title.toLocaleLowerCase().includes(needle));
      }

      const start = (input.page - 1) * input.page_size;
      const items = poems.slice(start, start + input.page_size);
      const hasMore = start + items.length < poems.length;

      const data = {
        total: poems.length,
        count: items.length,
        page: input.page,
        page_size: input.page_size,
        has_more: hasMore,
        next_page: hasMore ? input.page + 1 : null,
        category: { id: cat.id, title: cat.title, full_url: cat.fullUrl },
        poems: items.map((poem) => ({
          id: poem.id,
          title: poem.title,
          url_slug: poem.urlSlug,
          full_url: poemPath(cat, poem.urlSlug),
          excerpt: poem.excerpt ?? null,
        })),
      };

      return {
        data,
        markdown: () =>
          md(
            `# Poems in "${cat.title}" (category id ${cat.id})`,
            `${poems.length} poems match${hasMore ? " — more pages available" : ""}`,
            "",
            bullets(
              items.map(
                (poem) => `${poem.title} — id \`${poem.id}\` · ${siteUrl(poemPath(cat, poem.urlSlug))}`,
              ),
              "no poems matched",
            ),
            "",
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_category_geotags",
      title: "Get Category Geo Tags",
      description: `Get the geographic and historical locations tagged to poems within a Ganjoor category and its descendants.

Each tag pairs a place with the Hijri/Gregorian date a poem commemorates, which is how Ganjoor
records historical events (a battle, a siege) in poetry.

Args:
  - cat_id (number): Category id
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { total, tags: [{ id, latitude, longitude, lunar_date, gregorian_date, child_cat }] }

Examples:
  - "Where are the events in Hafez's poetry set?" -> cat_id=9

Notes:
  - Tag lists can be large (tens of entries for a whole diwan).
  - Coordinates are decimal degrees, WGS84.`,
      inputSchema: z
        .object({
          cat_id: IdSchema.describe("Category id whose subtree should be scanned for geo tags."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as { cat_id: number };
      const tags = await ganjoorGet<GanjoorGeoTag[]>(`/api/ganjoor/cat/${input.cat_id}/geotag`);

      const data = {
        total: tags.length,
        tags: tags.map((tag) => ({
          id: tag.id,
          latitude: tag.latitude,
          longitude: tag.longitude,
          lunar_date: tag.lunarDate,
          gregorian_date: tag.gregorianDate,
          lunar_date_total_number: tag.lunarDateTotalNumber,
          child_cat: tag.childCat ? { id: tag.childCat.id, title: tag.childCat.title } : null,
        })),
      };

      return {
        data,
        markdown: () =>
          md(
            `# Geo tags under category ${input.cat_id} (${tags.length} tags)`,
            "",
            bullets(
              tags.map((tag) => {
                const coords =
                  tag.latitude !== null && tag.longitude !== null
                    ? `${tag.latitude}, ${tag.longitude}`
                    : "no coordinates";
                const dates = [tag.lunarDate, tag.gregorianDate].filter(Boolean).join(" / ");
                return `${tag.childCat ? `[${tag.childCat.title}] ` : ""}${dates || "undated"} — ${coords}`;
              }),
              "no geo tags found",
            ),
            "",
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_category_people_graph",
      title: "Get Category People Graph",
      description: `Get the network of historical people relevant to a Ganjoor category or work.

Returns every person tagged in a poem under this category's subtree, plus their kinship and
affiliation ties one hop out — the data behind Ganjoor's "characters" (شخصیت‌ها) tab.

Args:
  - cat_id (number): Category id
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { node_count, edge_count, nodes: [{ id, name, importance }], edges: [{ from_person_id, to_person_id, relation }] }

Examples:
  - "Which historical figures appear in the Shahnameh?" -> cat_id=<Shahnameh category id>

Notes:
  - Empty graphs are normal for categories with no person tagging — that is not an error.`,
      inputSchema: z
        .object({
          cat_id: IdSchema.describe("Category id to build the people graph for."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as { cat_id: number };
      const graph = await ganjoorGet<{
        nodes?: Array<{ id: number; name: string; importance?: number }>;
        edges?: Array<{ from?: number; to?: number; relation?: string }>;
      }>(`/api/ganjoor/cat/${input.cat_id}/persongraph`);

      const nodes = graph?.nodes ?? [];
      const edges = graph?.edges ?? [];

      const data = {
        node_count: nodes.length,
        edge_count: edges.length,
        nodes: nodes.map((node) => ({
          id: node.id,
          name: node.name,
          importance: node.importance ?? null,
        })),
        edges: edges.map((edge) => ({
          from_person_id: edge.from ?? null,
          to_person_id: edge.to ?? null,
          relation: edge.relation ?? null,
        })),
      };

      return {
        data,
        markdown: () =>
          md(
            `# People graph for category ${input.cat_id}`,
            `${nodes.length} people, ${edges.length} relations`,
            "",
            bullets(
              nodes.map((node) => `${node.name} (person id \`${node.id}\`)`),
              "no people are tagged in this category",
            ),
            "",
          ),
      };
    },
  );
}
