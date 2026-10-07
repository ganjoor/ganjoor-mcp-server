import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodObject, ZodRawShape } from "zod";
import { toActionableError } from "../client.js";
import { ResponseFormat } from "../schemas.js";

/** Structured payload every tool returns alongside its rendered text. */
export interface ToolPayload {
  data: Record<string, unknown>;
  markdown: (args: Record<string, unknown>) => string;
}

/**
 * Thin wrapper around `server.registerTool` that guarantees every tool:
 * - reports failures as `isError` results instead of protocol-level errors,
 * - renders markdown vs JSON consistently,
 * - exposes structured content alongside text.
 */
export function defineTool<S extends ZodRawShape>(
  server: McpServer,
  config: {
    name: string;
    title: string;
    description: string;
    inputSchema: ZodObject<S>;
    annotations?: {
      readOnlyHint?: boolean;
      destructiveHint?: boolean;
      idempotentHint?: boolean;
      openWorldHint?: boolean;
    };
  },
  handler: (args: Record<string, unknown>) => Promise<ToolPayload>,
): void {
  server.registerTool(
    config.name,
    {
      title: config.title,
      description: config.description,
      inputSchema: config.inputSchema as never,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        ...config.annotations,
      },
    },
    (async (args: Record<string, unknown>) => {
      try {
        const result = await handler(args);
        const format = (args.response_format as ResponseFormat) ?? ResponseFormat.MARKDOWN;
        const markdown = result.markdown(args);
        const text =
          format === ResponseFormat.JSON ? JSON.stringify(result.data, null, 2) : markdown;

        return {
          content: [{ type: "text" as const, text }],
          structuredContent: result.data,
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: toActionableError(error) }],
        };
      }
    }) as never,
  );
}

/** Read-only hint object reused across tool definitions. */
export const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;
