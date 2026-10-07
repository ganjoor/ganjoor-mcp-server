#!/usr/bin/env node
/**
 * Ganjoor MCP Server — process entry point.
 *
 * Exposes the read-only public surface of the Ganjoor Persian poetry API
 * (https://api.ganjoor.net) as MCP tools.
 *
 * Transports:
 *   - stdio (default)  — for local clients such as VS Code, Claude Desktop, Cursor
 *   - streamable HTTP   — set HTTP=true, for remote/shared deployments
 *
 * The server factory lives in ./server.ts so tests can import it without
 * binding a transport.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Request, type Response } from "express";

import { API_BASE_URL, SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { createServer } from "./server.js";

/** Validate the upstream API is reachable before serving traffic. */
async function checkUpstream(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ganjoor/poets`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error(
        `[ganjoor-mcp] Warning: upstream probe returned ${response.status}. Tools will still load, ` +
          "but calls may fail until the API recovers.",
      );
    }
  } catch (error) {
    console.error(
      `[ganjoor-mcp] Warning: could not reach ${API_BASE_URL} (${
        error instanceof Error ? error.message : String(error)
      }). Tools will still load.`,
    );
  }
}

async function main(): Promise<void> {
  const useHttp = process.env.HTTP === "true";

  if (!useHttp) {
    // stdio transport: never write to stdout — it carries the protocol.
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Diagnostics go to stderr so they cannot corrupt the protocol stream.
    console.error(`[ganjoor-mcp] ${SERVER_NAME} v${SERVER_VERSION} listening on stdio`);
    return;
  }

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "127.0.0.1";
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // DNS-rebinding protection: only accept loopback origins by default.
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use((req: Request, res: Response, next) => {
    const origin = req.headers.origin;
    if (origin) {
      const isLoopback = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
      if (!isLoopback && !allowedOrigins.includes(origin)) {
        res.status(403).json({
          jsonrpc: "2.0",
          error: { code: -32001, message: "Origin not allowed" },
          id: null,
        });
        return;
      }
    }
    next();
  });

  app.get("/health", async (_req: Request, res: Response) => {
    try {
      const probe = await fetch(`${API_BASE_URL}/api/ganjoor/poets`, {
        signal: AbortSignal.timeout(8000),
      });
      res.json({ status: "ok", upstream: probe.ok ? "ok" : `status ${probe.status}` });
    } catch (error) {
      res.status(503).json({
        status: "degraded",
        upstream: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Stateless streamable HTTP: a new server per request keeps it horizontally scalable.
  app.all("/mcp", async (req: Request, res: Response) => {
    try {
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless mode
      });

      res.on("close", () => {
        void server.close();
        void transport.close();
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("[ganjoor-mcp] HTTP transport error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  await checkUpstream();

  app.listen(port, host, () => {
    console.error(`[ganjoor-mcp] ${SERVER_NAME} v${SERVER_VERSION} listening on http://${host}:${port}/mcp`);
  });
}

main().catch((error) => {
  console.error("[ganjoor-mcp] Fatal error:", error);
  process.exit(1);
});