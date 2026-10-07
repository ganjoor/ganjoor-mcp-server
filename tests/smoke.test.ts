/**
 * Live smoke test for the Ganjoor MCP server.
 *
 * Boots the server over an in-memory transport pair, lists every tool, and
 * invokes each one with a known-good argument set — asserting that the call
 * returns content and is not an error.
 *
 * Run with: npm test
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

/** One representative invocation per tool. */
const CASES: Array<{
  tool: string;
  args: Record<string, unknown>;
  /** Tools whose upstream feature may legitimately be disabled. */
  optional?: boolean;
}> = [
  { tool: "ganjoor_list_poets", args: { page_size: 3 } },
  { tool: "ganjoor_get_poet", args: { url: "hafez" } },
  { tool: "ganjoor_get_poets_by_century", args: {} },
  { tool: "ganjoor_list_books", args: { poet_id: 2, page_size: 3 } },

  // Hafez's ghazals are category 24 (his root category is 9).
  { tool: "ganjoor_get_category", args: { cat_id: 24, include_poems: true, poem_limit: 3 } },
  { tool: "ganjoor_list_category_poems", args: { cat_id: 24, page_size: 3 } },
  { tool: "ganjoor_get_category_geotags", args: { cat_id: 24 } },
  { tool: "ganjoor_get_category_people_graph", args: { cat_id: 24 } },

  { tool: "ganjoor_search_poems", args: { term: "صبر", poet_id: 2, page_size: 3 } },
  // Semantic search is an optional upstream feature; disabled here is a valid outcome.
  {
    tool: "ganjoor_semantic_search_poems",
    args: { query: "patience and trust in God", top_k: 2 },
    optional: true,
  },
  { tool: "ganjoor_get_poem", args: { url: "hafez/ghazal/sh494", include_recitations: false } },
  { tool: "ganjoor_get_poem_by_id", args: { poem_id: 2623, include_recitations: false } },
  { tool: "ganjoor_get_poem_verses", args: { poem_id: 2623 } },
  { tool: "ganjoor_get_random_poem", args: { include_recitations: false } },
  { tool: "ganjoor_get_hafez_faal", args: {} },
  { tool: "ganjoor_get_page_url", args: { id: 13836 } },
  { tool: "ganjoor_get_redirect_url", args: { url: "hafez/divan" } },

  { tool: "ganjoor_list_rhythms", args: { page_size: 5 } },
  { tool: "ganjoor_analyze_poem_rhythm", args: { poem_id: 2623 } },
  { tool: "ganjoor_analyze_poem_rhyme", args: { poem_id: 2623 } },
  {
    tool: "ganjoor_find_similar_poems",
    args: { metre: "فاعلاتن مفاعلن فعلن", rhyme: "", page_size: 3 },
  },
  { tool: "ganjoor_get_poem_sections", args: { poem_id: 2623 } },
  { tool: "ganjoor_get_section", args: { section_id: 38101, include_related: true } },
  { tool: "ganjoor_get_related_sections", args: { poem_id: 2623, section_index: 0, items_count: 3 } },
  { tool: "ganjoor_get_couplet_sections", args: { poem_id: 2623, couplet_index: 0 } },
  { tool: "ganjoor_get_language_tagged_sections", args: { language: "ar", page_size: 3 } },

  { tool: "ganjoor_search_recitations", args: { page_size: 3 } },
  { tool: "ganjoor_get_recitation", args: { recitation_id: 37535 } },
  { tool: "ganjoor_get_recitation_sync_info", args: { recitation_id: 37535 } },
  { tool: "ganjoor_get_poem_recitations", args: { poem_id: 2623, page_size: 3 } },
  { tool: "ganjoor_get_category_top_recitations", args: { cat_id: 24 } },

  { tool: "ganjoor_list_people", args: { page_size: 3 } },
  { tool: "ganjoor_get_person", args: { person_id: 22 } },
  { tool: "ganjoor_get_person_poems", args: { person_id: 22, page_size: 3 } },
  { tool: "ganjoor_get_person_relations", args: { person_id: 22 } },
  { tool: "ganjoor_get_person_family_tree", args: { person_id: 22 } },

  { tool: "ganjoor_get_recent_comments", args: { page_size: 3 } },
  { tool: "ganjoor_list_faq_categories", args: {} },
  { tool: "ganjoor_get_faq_items", args: { cat_id: 2, page_size: 3 } },
  { tool: "ganjoor_get_faq_item", args: { faq_id: 6 } },

  { tool: "ganjoor_get_poem_images", args: { poem_id: 2623 } },
  { tool: "ganjoor_get_poem_quoted_poems", args: { poem_id: 2623, items_count: 3 } },
  { tool: "ganjoor_get_poem_effective_corrections", args: { poem_id: 2623 } },
  { tool: "ganjoor_get_poem_geotags", args: { poem_id: 2623 } },
];

async function main(): Promise<void> {
  const server = createServer();
  const client = new Client({ name: "ganjoor-smoke-test", version: "1.0.0" });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const { tools } = await client.listTools();
  console.log(`Registered ${tools.length} tools.\n`);

  // Every registered tool must have a real description — an agent relies on it.
  const undescribed = tools.filter((tool) => !tool.description || tool.description.length < 80);
  if (undescribed.length) {
    console.error(
      `FAIL: ${undescribed.length} tool(s) have missing or too-short descriptions: ` +
        undescribed.map((tool) => tool.name).join(", "),
    );
    process.exitCode = 1;
  }

  let passed = 0;
  const failures: string[] = [];

  for (const testCase of CASES) {
    const registered = tools.some((tool) => tool.name === testCase.tool);
    if (!registered) {
      failures.push(`${testCase.tool}: tool not registered`);
      continue;
    }

    try {
      const result = await client.callTool({ name: testCase.tool, arguments: testCase.args });
      const text = (result.content as Array<{ type: string; text?: string }> | undefined) ?? [];
      const rendered = text.map((part) => part.text ?? "").join("");
      const isError = Boolean(result.isError);

      if (isError) {
        const detail = `${testCase.tool}: returned isError — ${rendered.slice(0, 160)}`;
        if (testCase.optional) {
          console.log(`  opt  ${testCase.tool} (upstream feature disabled)`);
        } else {
          failures.push(detail);
        }
        continue;
      }
      if (!rendered.trim()) {
        failures.push(`${testCase.tool}: returned empty content`);
        continue;
      }

      passed += 1;
      console.log(`  ok  ${testCase.tool} (${rendered.length} chars)`);
    } catch (error) {
      failures.push(`${testCase.tool}: threw — ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`\n${passed}/${CASES.length} tool calls succeeded.`);
  if (failures.length) {
    console.error(`\n${failures.length} failure(s):`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
  }

  await client.close();
  await server.close();
}

main().catch((error) => {
  console.error("Smoke test crashed:", error);
  process.exit(1);
});
