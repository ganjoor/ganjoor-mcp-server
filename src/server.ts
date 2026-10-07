import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { SERVER_INSTRUCTIONS, SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { registerPoetTools } from "./tools/poets.js";
import { registerCategoryTools } from "./tools/categories.js";
import { registerPoemTools } from "./tools/poems.js";
import { registerAnalysisTools } from "./tools/analysis.js";
import { registerAudioTools } from "./tools/audio.js";
import { registerPeopleTools, registerCommentAndFaqTools } from "./tools/people.js";
import { registerContentTools } from "./tools/content.js";

/**
 * Build a fresh MCP server instance with every tool registered.
 *
 * Kept separate from the process entry point so tests can construct a server
 * without binding a transport.
 */
export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
      title: "Ganjoor Poetry",
    },
    {
      instructions: SERVER_INSTRUCTIONS,
    },
  );

  registerPoetTools(server);
  registerCategoryTools(server);
  registerPoemTools(server);
  registerAnalysisTools(server);
  registerAudioTools(server);
  registerPeopleTools(server);
  registerCommentAndFaqTools(server);
  registerContentTools(server);

  return server;
}
