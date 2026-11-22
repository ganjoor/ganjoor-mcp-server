import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

const publicApi = "https://api.ganjoor.net";
const apiBase = (process.env.GANJOOR_API_BASE_URL ?? publicApi).replace(/\/+$/, "");
const searchBase = (process.env.GANJOOR_SEMANTIC_BASE_URL ??
  (apiBase === publicApi ? "https://ganjgah.ir" : apiBase)).replace(/\/+$/, "");
const legacy = searchBase === apiBase;

test("semantic search routes independently and preserves the MCP result shape", async (t) => {
  const requests: { url: URL; body: unknown }[] = [];
  const poem = { title: "Test poem", fullTitle: "Test poet » Test poem", fullUrl: "/test/poem" };
  t.mock.method(globalThis, "fetch", async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    requests.push({ url, body });

    if (init?.method !== "POST") return new Response("[]");
    const fixture = legacy
      ? [{ ...poem, id: 123, plainText: "First line\nSecond line" }]
      : { results: [{ ...poem, poemId: 123, verses: [{ text: "First line" }, { text: "Second line" }] }] };
    return new Response(JSON.stringify(fixture));
  });

  const server = createServer();
  const client = new Client({ name: "semantic-routing-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const semantic = await client.callTool({
      name: "ganjoor_semantic_search_poems",
      arguments: { query: "longing", top_k: 2, response_format: "json" },
    });
    assert.ok(!semantic.isError);
    assert.deepEqual(semantic.structuredContent, {
      query: "longing",
      count: 1,
      results: [{
        id: 123,
        title: poem.title,
        full_title: poem.fullTitle,
        full_url: poem.fullUrl,
        couplets_count: null,
        language: null,
        plain_text: "First line\nSecond line",
      }],
    });

    const scoped = await client.callTool({
      name: "ganjoor_semantic_search_poems",
      arguments: { query: "longing", poet_id: 2, cat_id: 24 },
    });
    assert.ok(!scoped.isError);
    const prose = (scoped.content as { text: string }[])[0].text;
    assert.match(prose, /Test poet » Test poem/);
    assert.match(prose, /First line\nSecond line/);

    const textSearch = await client.callTool({
      name: "ganjoor_search_poems",
      arguments: { term: "صبر" },
    });
    assert.ok(!textSearch.isError);

    assert.equal(requests.length, 3);
    assert.equal(requests[0].url.href, `${searchBase}/api/ganjoor/search/semantic`);
    assert.deepEqual(requests[0].body, {
      query: "longing", topK: 2, disableScopeDetection: false,
      ...(legacy ? { poetId: 0, catId: 0 } : {}),
    });
    assert.equal(requests[1].url.href, `${searchBase}/api/ganjoor/search/semantic`);
    assert.deepEqual(requests[1].body, {
      query: "longing", topK: 10, poetId: 2, catId: 24, disableScopeDetection: false,
    });
    assert.equal(requests[2].url.href.split("?", 1)[0], `${apiBase}/api/ganjoor/poems/search`);
    assert.equal(requests[2].url.searchParams.get("term"), "صبر");
  } finally {
    await client.close();
    await server.close();
  }
});
