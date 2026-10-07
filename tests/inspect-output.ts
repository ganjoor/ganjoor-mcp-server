/**
 * Output inspection — prints real tool responses so the rendered shape can be
 * reviewed by eye (markdown readability, JSON field naming, truncation).
 *
 * Run with: npm run inspect [toolName]
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

const SHOWCASE: Array<{ label: string; tool: string; args: Record<string, unknown> }> = [
  {
    label: "POEM (markdown) — the flagship output",
    tool: "ganjoor_get_poem",
    args: { url: "hafez/ghazal/sh494", include_recitations: true, include_verse_details: false },
  },
  {
    label: "POET (markdown) — biography + books",
    tool: "ganjoor_get_poet",
    args: { url: "saadi", include_cats: true },
  },
  {
    label: "CATEGORY (markdown) — breadcrumb + children + poems",
    tool: "ganjoor_get_category",
    args: { cat_id: 24, include_poems: true, poem_limit: 4 },
  },
  {
    label: "SEARCH (json) — structured pagination envelope",
    tool: "ganjoor_search_poems",
    args: { term: "صبر", poet_id: 2, page_size: 2, response_format: "json" },
  },
  {
    label: "POETS BY CENTURY (markdown) — grouped output",
    tool: "ganjoor_get_poets_by_century",
    args: { response_format: "markdown" },
  },
  {
    label: "SIMILAR POEMS (markdown) — metre/rhyme matching",
    tool: "ganjoor_find_similar_poems",
    args: { metre: "فاعلاتن مفاعلن فعلن", poet_id: 2, page_size: 5 },
  },
  {
    label: "VERSES (markdown) — couplet rendering",
    tool: "ganjoor_get_poem_verses",
    args: { poem_id: 2623, include_summary: true },
  },
  {
    label: "PERSON FAMILY TREE (markdown) — kinship component",
    tool: "ganjoor_get_person_family_tree",
    args: { person_id: 22 },
  },
];

async function main(): Promise<void> {
  const only = process.argv[2];
  const server = createServer();
  const client = new Client({ name: "ganjoor-inspect", version: "1.0.0" });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  for (const item of SHOWCASE) {
    if (only && !item.tool.includes(only)) continue;

    const result = await client.callTool({ name: item.tool, arguments: item.args });
    const parts = (result.content as Array<{ text?: string }> | undefined) ?? [];
    const text = parts.map((part) => part.text ?? "").join("\n");

    const bar = "=".repeat(78);
    console.log(`\n${bar}\n${item.label}\n${item.tool} ${JSON.stringify(item.args)}\n${bar}\n`);
    console.log(text.slice(0, 2600));
    if (text.length > 2600) console.log(`\n… [${text.length - 2600} more chars]`);
    if (result.isError) console.log("\n*** isError=true ***");
  }

  await client.close();
  await server.close();
}

main().catch((error) => {
  console.error("Inspection failed:", error);
  process.exit(1);
});
