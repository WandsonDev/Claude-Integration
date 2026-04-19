import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildToolset } from "./tools/index.js";
import type { Config } from "./types.js";
import type { Tool } from "./tools/index.js";
import { z } from "zod";

function schemaToZod(properties: Record<string, unknown>, required: string[] = []): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, def] of Object.entries(properties)) {
    const prop = def as Record<string, unknown>;
    let schema: z.ZodTypeAny;

    switch (prop.type) {
      case "number":
        schema = z.number();
        break;
      case "boolean":
        schema = z.boolean();
        break;
      case "array":
        schema = z.array(z.string());
        break;
      default:
        schema = z.string();
    }

    if (!required.includes(key)) {
      schema = schema.optional();
    }

    shape[key] = schema;
  }

  return shape;
}

function createMcpServer(tools: Tool[]): McpServer {
  const server = new McpServer({
    name: "claude-integration",
    version: "1.0.0",
  });

  for (const tool of tools) {
    const shape = schemaToZod(
      tool.inputSchema.properties,
      tool.inputSchema.required ?? []
    );
    server.tool(
      tool.name,
      tool.description,
      shape,
      async (args) => {
        const result = await tool.handler(args as Record<string, unknown>);
        return { content: [{ type: "text", text: result }] };
      }
    );
  }

  return server;
}

export async function startServer(config: Config): Promise<void> {
  const tools = buildToolset(config.dir, config.enabledGroups);
  const app = express();
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.json({
      name: "Claude Integration MCP Server",
      version: "1.0.0",
      project: config.dir,
      port: config.port,
      tools: tools.length,
      groups: config.enabledGroups,
      endpoint: `http://localhost:${config.port}/mcp`,
    });
  });

  app.post("/mcp", async (req, res) => {
    const server = createMcpServer(tools);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  await new Promise<void>((resolve) => {
    app.listen(config.port, () => resolve());
  });
}
