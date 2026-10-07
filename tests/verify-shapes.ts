import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

async function main(): Promise<void> {
  const server = createServer();
  const client = new Client({ name: "verify", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);

  const checks: Array<{ tool: string; args: Record<string, unknown> }> = [
    { tool: "ganjoor_get_recitation_sync_info", args: { recitation_id: 37535 } },
    { tool: "ganjoor_get_person_relations", args: { person_id: 1 } },
    { tool: "ganjoor_get_poem_sections", args: { poem_id: 2623 } },
    { tool: "ganjoor_get_poem_recitations", args: { poem_id: 2623, page_size: 2 } },
    { tool: "ganjoor_list_books", args: { poet_id: 2, page_size: 4 } },
    { tool: "ganjoor_get_category_geotags", args: { cat_id: 9 } },
  ];

  for (const check of checks) {
    const r = await client.callTool({ name: check.tool, arguments: check.args });
    const text = (r.content as Array<{ text?: string }>).map((p) => p.text ?? "").join("\n");
    console.log(`\n${"=".repeat(70)}\n${check.tool} ${JSON.stringify(check.args)}\n${"=".repeat(70)}`);
    console.log(text.slice(0, 900));
    if (r.isError) console.log("*** isError ***");
  }

  await client.close();
  await server.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
