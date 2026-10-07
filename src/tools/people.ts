import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ganjoorGet, fetchPaged } from "../client.js";
import { IdSchema, PaginationSchema, ResponseFormatSchema } from "../schemas.js";
import { bullets, hijriToGregorianApprox, md } from "../format.js";
import { defineTool, READ_ONLY } from "./registry.js";
import type {
  GanjoorFAQCategory,
  GanjoorFAQItem,
  GanjoorFamilyTreeViewModel,
  GanjoorPerson,
  GanjoorPersonRelationsViewModel,
} from "../types.js";

const GENDER_LABEL: Record<number, string> = { 0: "unknown", 1: "male", 2: "female" };

/**
 * Kinship kinds as encoded by Ganjoor's `relationType` enum.
 * Labels are best-effort; unknown values fall back to `type <n>`.
 */
const RELATION_KIND_LABELS: Record<number, string> = {
  0: "parent",
  1: "child",
  2: "spouse",
  3: "sibling",
  4: "grandparent",
  5: "grandchild",
  6: "uncle/aunt",
  7: "nephew/niece",
  8: "cousin",
  9: "in-law",
};

/** Register tools for Ganjoor's related-people graph. */
export function registerPeopleTools(server: McpServer): void {
  defineTool(
    server,
    {
      name: "ganjoor_list_people",
      title: "List Ganjoor People",
      description: `List the historical and literary figures Ganjoor has catalogued as related persons (شخصیت‌ها).

These are people who appear in a poem's commentary or annotations — rulers, prophets, companions,
poets' contemporaries — as distinct from poets themselves.

Args:
  - search (string): Optional filter — only people whose name contains this text
  - page (number): Page number, starting from 1 (default: 1)
  - page_size (number): Items per page, 1-100 (default: 20)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { total, count, page, page_size, has_more, next_page, people: [{ id, name, birth_year_hijri, death_year_hijri, birth_location, death_location, importance, gender }] }

Examples:
  - "Who does Ganjoor know about?" -> no arguments
  - "Find the person named 'حافظ'" -> search='حافظ'

Notes:
  - Filtering is done client-side; the full list is a few hundred entries.
  - \`importance\` ranks how central the person is; higher means better documented.`,
      inputSchema: z
        .object({
          search: z
            .string()
            .trim()
            .max(200)
            .optional()
            .describe("Case-insensitive substring filter on the person's name."),
          page: PaginationSchema.shape.page,
          page_size: PaginationSchema.shape.page_size,
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as {
        search?: string;
        page: number;
        page_size: number;
      };

      const all = await ganjoorGet<GanjoorPerson[]>("/api/people");
      const people = Array.isArray(all) ? all : [];

      const filtered = input.search
        ? people.filter((person) =>
            person.name.toLocaleLowerCase().includes(input.search!.toLocaleLowerCase()),
          )
        : people;

      const start = (input.page - 1) * input.page_size;
      const items = filtered.slice(start, start + input.page_size);
      const hasMore = start + items.length < filtered.length;

      const data = {
        total: filtered.length,
        count: items.length,
        page: input.page,
        page_size: input.page_size,
        has_more: hasMore,
        next_page: hasMore ? input.page + 1 : null,
        people: items.map((person) => ({
          id: person.id,
          name: person.name,
          birth_year_hijri: person.validBirthDate ? person.birthYearInLHijri : null,
          death_year_hijri: person.validDeathDate ? person.deathYearInLHijri : null,
          birth_location: person.birthLocation,
          death_location: person.deathLocation,
          importance: person.importance,
          gender: GENDER_LABEL[person.gender] ?? String(person.gender),
          wiki_url: person.wikiUrl,
        })),
      };

      return {
        data,
        markdown: () =>
          md(
            `# Ganjoor people (${items.length} of ${filtered.length}, page ${input.page})`,
            hasMore ? "More — increase `page`." : null,
            "",
            bullets(
              items.map((person) => {
                const life = person.validBirthDate ? `${person.birthYearInLHijri} AH` : "?";
                const death = person.validDeathDate ? `${person.deathYearInLHijri} AH` : "?";
                return `${person.name} — person id \`${person.id}\`, ${life}–${death}${
                  person.birthLocation ? `, born in ${person.birthLocation}` : ""
                }`;
              }),
              "no people matched that filter",
            ),
            "",
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_person",
      title: "Get Ganjoor Person",
      description: `Get one person's full record — biography, dates, places, and external references.

Args:
  - person_id (number): Numeric person id (from ganjoor_list_people)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { id, name, description, wiki_url, birth_year_hijri, death_year_hijri, birth_location, death_location, family_tree_caption, machine_generated, importance, gender }

Examples:
  - "Who is person 22?" -> person_id=22

Notes:
  - \`machine_generated\` marks entries created automatically; their biographies may be sparse.
  - Follow with ganjoor_get_person_poems or ganjoor_get_person_relations for context.`,
      inputSchema: z
        .object({
          person_id: IdSchema.describe("Numeric person id."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as { person_id: number };
      const person = await ganjoorGet<GanjoorPerson>(`/api/people/${input.person_id}`);

      const data = {
        id: person.id,
        name: person.name,
        description: person.description,
        wiki_url: person.wikiUrl,
        birth_year_hijri: person.validBirthDate ? person.birthYearInLHijri : null,
        death_year_hijri: person.validDeathDate ? person.deathYearInLHijri : null,
        birth_location: person.birthLocation,
        death_location: person.deathLocation,
        family_tree_caption: person.familyTreeCaption,
        machine_generated: person.machineGenerated,
        importance: person.importance,
        gender: GENDER_LABEL[person.gender] ?? String(person.gender),
      };

      return {
        data,
        markdown: () =>
          md(
            `# ${person.name} (person id ${person.id})`,
            `- **Born**: ${
              person.validBirthDate
                ? `${person.birthYearInLHijri} AH (≈ ${hijriToGregorianApprox(person.birthYearInLHijri)} CE)${
                    person.birthLocation ? ` in ${person.birthLocation}` : ""
                  }`
                : "unknown"
            }`,
            `- **Died**: ${
              person.validDeathDate
                ? `${person.deathYearInLHijri} AH (≈ ${hijriToGregorianApprox(person.deathYearInLHijri)} CE)${
                    person.deathLocation ? ` in ${person.deathLocation}` : ""
                  }`
                : "unknown"
            }`,
            `- **Gender**: ${GENDER_LABEL[person.gender] ?? person.gender}`,
            person.wikiUrl ? `- **Reference**: ${person.wikiUrl}` : null,
            "",
            ...(person.description ? ["## Description", "", person.description, ""] : []),
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_person_poems",
      title: "Get Poems Tagged With A Person",
      description: `Get every poem Ganjoor has tagged with a given person.

This is the strongest link between a historical figure and the poetry about them.

Args:
  - person_id (number): Numeric person id
  - page (number): Page number, starting from 1 (default: 1)
  - page_size (number): Items per page, 1-100 (default: 20)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { person_id, total, count, page, page_size, has_more, next_page, poems: [{ id, title, full_url }] }

Examples:
  - "Which poems mention this figure?" -> person_id=<id>

Notes:
  - Tagging is curated and incomplete for older figures.`,
      inputSchema: z
        .object({
          person_id: IdSchema.describe("Numeric person id."),
          page: PaginationSchema.shape.page,
          page_size: PaginationSchema.shape.page_size,
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as { person_id: number; page: number; page_size: number };
      const all = await ganjoorGet<Array<{ id: number; title: string; fullUrl?: string }>>(
        `/api/people/${input.person_id}/poems`,
      );
      const poems = Array.isArray(all) ? all : [];

      const start = (input.page - 1) * input.page_size;
      const items = poems.slice(start, start + input.page_size);
      const hasMore = start + items.length < poems.length;

      const data = {
        person_id: input.person_id,
        total: poems.length,
        count: items.length,
        page: input.page,
        page_size: input.page_size,
        has_more: hasMore,
        next_page: hasMore ? input.page + 1 : null,
        poems: items.map((poem) => ({
          id: poem.id,
          title: poem.title,
          full_url: poem.fullUrl ?? null,
        })),
      };

      return {
        data,
        markdown: () =>
          md(
            `# Poems tagged with person ${input.person_id} (${items.length} of ${poems.length})`,
            "",
            bullets(
              items.map((poem) => `${poem.title} — id \`${poem.id}\`${poem.fullUrl ? ` · ${poem.fullUrl}` : ""}`),
              "no poems are tagged with this person",
            ),
            "",
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_person_relations",
      title: "Get Person Relations",
      description: `Get a person's kinship and affiliation edges — parents, siblings, spouses, teachers, and contemporaries.

Args:
  - person_id (number): Numeric person id
  - relation_type (string): Optional filter — only relations of this kind, e.g. 'father', 'son', 'spouse', 'student', 'teacher'
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { person_id, relation_count, relations: [{ id, from_person_id, from_person_name, to_person_id, to_person_name, relation_kind, relation_name }] }

Examples:
  - "Who was this person's teacher?" -> person_id=<id>, relation_type='teacher'

Notes:
  - Edges are stored undirected with a kind; the same edge appears once.
  - Use ganjoor_get_person_family_tree for the whole connected component.`,
      inputSchema: z
        .object({
          person_id: IdSchema.describe("Numeric person id."),
          relation_type: z
            .string()
            .trim()
            .max(60)
            .optional()
            .describe("Optional filter on the relation kind, e.g. 'father', 'spouse', 'teacher'."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as { person_id: number; relation_type?: string };
      const result = await ganjoorGet<GanjoorPersonRelationsViewModel>(
        `/api/people/${input.person_id}/relations`,
      );

      const subject = result?.person;
      const all = result?.relations ?? [];
      const affiliations = result?.affiliations ?? [];

      const label = (relationType: number): string => RELATION_KIND_LABELS[relationType] ?? `type ${relationType}`;

      const edges = [
        ...all.map((relation) => ({
          kind: "kinship" as const,
          relation_type: relation.relationType,
          relation_label: label(relation.relationType),
          other_person_id: relation.otherPersonId,
          other_person_name: relation.otherPersonName,
          note: relation.note ?? null,
          evidence_count: (relation.evidence ?? []).length,
          evidence_poem_ids: (relation.evidence ?? [])
            .map((item) => item.poemId)
            .filter((id): id is number => typeof id === "number"),
        })),
        ...affiliations.map((affiliation) => ({
          kind: "affiliation" as const,
          relation_type: affiliation.affiliationType,
          relation_label: "affiliation",
          other_person_id: affiliation.otherPersonId,
          other_person_name: affiliation.otherPersonName,
          note: affiliation.note ?? null,
          evidence_count: 0,
          evidence_poem_ids: [] as number[],
        })),
      ];

      // Upstream exposes relation kinds as numeric ids, so filtering by name is done here.
      const relations = input.relation_type
        ? edges.filter((edge) =>
            `${edge.relation_label} ${edge.relation_type}`
              .toLocaleLowerCase()
              .includes(input.relation_type!.toLocaleLowerCase()),
          )
        : edges;

      const data = {
        person_id: input.person_id,
        person_name: subject?.name ?? null,
        relation_count: relations.length,
        relations: relations.map((edge) => ({
          kind: edge.kind,
          relation_type: edge.relation_type,
          relation_label: edge.relation_label,
          other_person_id: edge.other_person_id,
          other_person_name: edge.other_person_name,
          note: edge.note,
          evidence_count: edge.evidence_count,
          evidence_poem_ids: edge.evidence_poem_ids,
        })),
      };

      return {
        data,
        markdown: () =>
          md(
            `# Relations of ${data.person_name ?? `person ${input.person_id}`} (${relations.length})`,
            "",
            bullets(
              relations.map(
                (edge) =>
                  `${edge.relation_label} — ${edge.other_person_name ?? `person ${edge.other_person_id}`}` +
                  (edge.evidence_count ? ` (${edge.evidence_count} citing verses)` : null),
              ),
              "no relations recorded",
            ),
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_person_family_tree",
      title: "Get Person Family Tree",
      description: `Get the full connected kinship component reachable from a person — ancestors, descendants, spouses, and siblings.

This returns the whole clan cluster, not just one hop, which makes it the right tool for tracing a
figure's lineage across generations.

Args:
  - person_id (number): Numeric person id
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { person_id, root_id, person_count, people: [{ id, name, birth_year_hijri, death_year_hijri, family_tree_caption }], relation_count, relations: [{ person1_id, person1_name, person2_id, person2_name, relation_label }] }

Examples:
  - "Show me this figure's lineage" -> person_id=<id>

Notes:
  - Components can be large for well-documented dynasties (the Kayumars tree has ~56 people).
  - Data quality varies: some edges are machine-generated and may be speculative — check the
    machine_generated flag per person.`,
      inputSchema: z
        .object({
          person_id: IdSchema.describe("Numeric person id to start the traversal from."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as { person_id: number };
      // Upstream returns rootId/persons/relations — note the key is persons, not people.
      const tree = await ganjoorGet<GanjoorFamilyTreeViewModel>(
        `/api/people/${input.person_id}/familytree`,
      );

      const persons = tree?.persons ?? [];
      const relations = tree?.relations ?? [];
      const nameById = new Map(persons.map((person) => [person.id, person.name]));

      const data = {
        person_id: input.person_id,
        root_id: tree?.rootId ?? null,
        person_count: persons.length,
        people: persons.map((person) => ({
          id: person.id,
          name: person.name,
          birth_year_hijri: person.validBirthDate ? person.birthYearInLHijri : null,
          death_year_hijri: person.validDeathDate ? person.deathYearInLHijri : null,
          birth_location: person.birthLocation,
          death_location: person.deathLocation,
          family_tree_caption: person.familyTreeCaption,
          machine_generated: person.machineGenerated,
        })),
        relation_count: relations.length,
        relations: relations.map((relation) => ({
          person1_id: relation.person1Id,
          person1_name: nameById.get(relation.person1Id) ?? null,
          person2_id: relation.person2Id,
          person2_name: nameById.get(relation.person2Id) ?? null,
          relation_label: RELATION_KIND_LABELS[relation.relationType] ?? `type ${relation.relationType}`,
        })),
      };

      return {
        data,
        markdown: () =>
          md(
            `# Family tree from person ${input.person_id} — ${persons.length} people, ${relations.length} relations`,
            "",
            bullets(
              data.people.map(
                (person) =>
                  `${person.name} — id \`${person.id}\`${
                    person.birth_year_hijri ? `, ${person.birth_year_hijri} AH` : ""
                  }`,
              ),
              "no family data available for this person",
            ),
          ),
      };
    },
  );
}

/** Register FAQ and commentary tools. */
export function registerCommentAndFaqTools(server: McpServer): void {
  defineTool(
    server,
    {
      name: "ganjoor_get_recent_comments",
      title: "Get Recent Ganjoor Comments",
      description: `Get the most recent published reader comments across Ganjoor, optionally filtered.

Comments are scholarly notes attached to a specific couplet of a poem.

Args:
  - term (string): Optional text filter applied to comment bodies
  - filter_user_id (string): Optional UUID — only comments by this user
  - page (number): Page number, starting from 1 (default: 1)
  - page_size (number): Items per page, 1-100 (default: 20)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { count, page, page_size, has_more, next_page, comments: [{ id, poem_id, poem_title, couplet_index, user, text, date, has_owner_response }] }

Examples:
  - "What are people discussing?" -> no arguments
  - "Comments about 'انتظار'" -> term='انتظار'

Notes:
  - Ordering is by recency, so results change over time — not suitable for questions whose answer
    must stay stable.
  - Replies are not included, only top-level comments.`,
      inputSchema: z
        .object({
          term: z
            .string()
            .trim()
            .max(200)
            .optional()
            .describe("Optional substring filter applied to comment text."),
          filter_user_id: z
            .string()
            .trim()
            .uuid()
            .optional()
            .describe("Optional user UUID — only that user's comments."),
          page: PaginationSchema.shape.page,
          page_size: PaginationSchema.shape.page_size,
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as {
        term?: string;
        filter_user_id?: string;
        page: number;
        page_size: number;
      };

      const list = await fetchPaged<{
        id: number;
        poemId?: number;
        poemTitle?: string;
        poemUrl?: string;
        coupletIndex?: number;
        userName?: string;
        text?: string;
        sendDate?: string;
        hasOwnerResponse?: boolean;
      }>("/api/ganjoor/comments", input.page, input.page_size, {
        term: input.term,
        filterUserId: input.filter_user_id,
      });

      const comments = list.items.map((comment) => ({
        id: comment.id,
        poem_id: comment.poemId ?? null,
        poem_title: comment.poemTitle ?? null,
        poem_url: comment.poemUrl ?? null,
        couplet_index: comment.coupletIndex ?? null,
        user: comment.userName ?? null,
        text: comment.text ?? null,
        date: comment.sendDate ?? null,
        has_owner_response: comment.hasOwnerResponse ?? false,
      }));

      const data = {
        count: comments.length,
        page: list.page,
        page_size: list.page_size,
        has_more: list.has_more,
        next_page: list.next_page,
        comments,
      };

      const commentBlocks = comments.map((comment) =>
        md(
          `## ${comment.poem_title ?? `poem ${comment.poem_id}`}${
            comment.couplet_index !== null ? ` — couplet ${comment.couplet_index + 1}` : ""
          }`,
          `- **By**: ${comment.user ?? "anonymous"} · **Date**: ${comment.date ?? "—"}`,
          "",
          comment.text ?? "",
          "",
          ),
      );

      return {
        data,
        markdown: () =>
          md(
            `# Recent comments (${comments.length}, page ${list.page})`,
            list.has_more ? "More — increase `page`." : null,
            "",
            ...commentBlocks,
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_list_faq_categories",
      title: "List Ganjoor FAQ Categories",
      description: `List the Ganjoor site's published FAQ (پرسش‌های متداول) categories.

These are editorial explanations of how Ganjoor works — text sourcing, version differences,
contribution rules.

Args:
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { count, categories: [{ id, title, description, item_count }] }

Examples:
  - "What topics does Ganjoor's FAQ cover?" -> no arguments

Notes:
  - Follow up with ganjoor_get_faq_items using a category id.`,
      inputSchema: z.object({ response_format: ResponseFormatSchema }).strict(),
      annotations: READ_ONLY,
    },
    async () => {
      const categories = await ganjoorGet<GanjoorFAQCategory[]>("/api/faq/cat");
      const list = Array.isArray(categories) ? categories : [];

      const data = {
        count: list.length,
        categories: list.map((category) => ({
          id: category.id,
          title: category.title,
          description: category.description,
          item_count: (category.items ?? []).length,
        })),
      };

      const categoryBlocks = list.map((category) =>
        md(
          `## ${category.title} (id \`${category.id}\`)`,
          category.description ?? "",
        ),
      );

      return {
        data,
        markdown: () =>
          md(
            `# Ganjoor FAQ categories (${list.length})`,
            "",
            categoryBlocks.join("\n\n"),
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_faq_items",
      title: "Get Ganjoor FAQ Items",
      description: `Get every published question-and-answer in a Ganjoor FAQ category.

Args:
  - cat_id (number): FAQ category id (from ganjoor_list_faq_categories)
  - page (number): Page number, starting from 1 (default: 1)
  - page_size (number): Items per page, 1-100 (default: 20)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { cat_id, total, count, page, page_size, has_more, next_page, items: [{ id, question, answer, answer_excerpt }] }

Examples:
  - "How does Ganjoor decide which text to use?" -> cat_id=<id>, then read the answers

Notes:
  - Answers are Persian prose and may contain HTML markup from the source; return them verbatim.
  - Despite its name, answerExcerpt carries the complete body — fullAnswer is always empty upstream.`,
      inputSchema: z
        .object({
          cat_id: IdSchema.describe("FAQ category id."),
          page: PaginationSchema.shape.page,
          page_size: PaginationSchema.shape.page_size,
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as { cat_id: number; page: number; page_size: number };
      const all = await ganjoorGet<GanjoorFAQItem[]>("/api/faq/cat/items", { catId: input.cat_id });
      const items = Array.isArray(all) ? all : [];

      const start = (input.page - 1) * input.page_size;
      const pageItems = items.slice(start, start + input.page_size);
      const hasMore = start + pageItems.length < items.length;

      const data = {
        cat_id: input.cat_id,
        total: items.length,
        count: pageItems.length,
        page: input.page,
        page_size: input.page_size,
        has_more: hasMore,
        next_page: hasMore ? input.page + 1 : null,
        items: pageItems.map((item) => ({
          id: item.id,
          question: item.question,
          answer: item.answerExcerpt ?? item.fullAnswer ?? null,
          answer_excerpt: item.answerExcerpt ?? null,
        })),
      };

      const itemBlocks = pageItems.map((item) =>
        md(`## ${item.question}`, "", item.answerExcerpt ?? item.fullAnswer ?? null),
      );

      return {
        data,
        markdown: () =>
          md(
            `# FAQ items in category ${input.cat_id} (${pageItems.length} of ${items.length})`,
            "",
            itemBlocks.join("\n\n"),
          ),
      };
    },
  );

  defineTool(
    server,
    {
      name: "ganjoor_get_faq_item",
      title: "Get Ganjoor FAQ Item",
      description: `Get one Ganjoor FAQ entry by its numeric id.

Args:
  - faq_id (number): FAQ item id (from ganjoor_get_faq_items)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: { id, category_id, question, answer, answer_excerpt, pinned }

Examples:
  - "Show FAQ item 7" -> faq_id=7

Notes:
  - Despite its name, answerExcerpt carries the complete body; fullAnswer is always empty upstream.
  - Only published items are served. An upstream 500 usually means the id does not exist — re-check
    the id from ganjoor_get_faq_items.`,
      inputSchema: z
        .object({
          faq_id: IdSchema.describe("Numeric FAQ item id."),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: READ_ONLY,
    },
    async (args) => {
      const input = args as unknown as { faq_id: number };
      const item = await ganjoorGet<GanjoorFAQItem>(`/api/faq/${input.faq_id}`);
      const answer = item.answerExcerpt ?? item.fullAnswer ?? null;

      const data = {
        id: item.id,
        category_id: item.categoryId,
        question: item.question,
        answer,
        answer_excerpt: item.answerExcerpt ?? null,
        pinned: item.pinned ?? false,
      };

      return {
        data,
        markdown: () =>
          md(
            `## ${item.question}`,
            "",
            answer ?? "This FAQ entry has no answer text.",
          ),
      };
    },
  );
}
