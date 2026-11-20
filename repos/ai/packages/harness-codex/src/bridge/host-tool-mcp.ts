#!/usr/bin/env node
// MCP-stdio tool server spawned by the codex CLI when
// `mcp_servers.harness-tools` is configured. Exposes host-defined tools
// over MCP-stdio and round-trips each call to the bridge's HTTP relay.
//
// Env vars (set by the bridge when starting a turn):
//   TOOL_SCHEMAS    — JSON array of { name, description, inputSchema }
//   TOOL_RELAY_URL  — http://127.0.0.1:<port> of the bridge relay server
// Relay authorization is issued by bridge runtime events, not an env token.

/*
 * CONSTRAINT — the third-party imports below are NEVER bundled into the
 * compiled `bridge/host-tool-mcp.mjs`. They are declared `external` in
 * tsup.config.ts and resolved at runtime from the node_modules that the
 * bridge installs *inside the sandbox* from `src/bridge/package.json` (and
 * its pinned `pnpm-lock.yaml`). That bridge package.json — NOT this host
 * package — is the single source of truth for these packages and their
 * versions; the published `@ai-sdk/harness-codex` package does not provide
 * them at runtime.
 *
 * When adding or changing a third-party import here you MUST keep all three
 * in sync, or this server will either get the dependency bundled in or fail
 * to resolve it in the sandbox:
 *   1. the import statement below,
 *   2. the `external` array in tsup.config.ts, and
 *   3. the dependency entry in `src/bridge/package.json`.
 */
import * as mcpServerModule from '@modelcontextprotocol/sdk/server/mcp.js';
import * as mcpStdioModule from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod/v4';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { McpServer } = mcpServerModule as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { StdioServerTransport } = mcpStdioModule as any;

type ToolSchema = {
  name: string;
  description?: string;
  inputSchema?: JsonSchemaObject;
};

type JsonSchemaObject = {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchemaObject>;
  required?: string[];
  items?: JsonSchemaObject;
  enum?: unknown[];
  const?: unknown;
  oneOf?: JsonSchemaObject[];
  anyOf?: JsonSchemaObject[];
  additionalProperties?: boolean | JsonSchemaObject;
  nullable?: boolean;
};

const schemas: ToolSchema[] = JSON.parse(process.env.TOOL_SCHEMAS || '[]');
const relayUrl = process.env.TOOL_RELAY_URL || '';

if (!schemas.length || !relayUrl) {
  process.stderr.write(
    '[host-tool-mcp] Missing TOOL_SCHEMAS or TOOL_RELAY_URL; exiting\n',
  );
  process.exit(0);
}

const server = new McpServer({ name: 'harness-tools', version: '1.0.0' });

for (const schema of schemas) {
  const shape = toZodShape(schema.inputSchema);
  server.tool(
    schema.name,
    schema.description ?? '',
    shape,
    async (input: Record<string, unknown>) => {
      const requestId = crypto.randomUUID();
      try {
        const res = await fetch(relayUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requestId, toolName: schema.name, input }),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(
            `Tool relay ${schema.name} failed with ${res.status}: ${body.slice(0, 500)}`,
          );
        }
        const data = (await res.json()) as { result?: unknown };
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(data.result ?? null),
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );
}

function toZodShape(
  schema: JsonSchemaObject | undefined,
): Record<string, z.ZodTypeAny> {
  if (!schema?.properties) return {};
  const required = new Set(schema.required ?? []);
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, propSchema] of Object.entries(schema.properties)) {
    const propType = toZodType(propSchema);
    shape[key] = required.has(key) ? propType : propType.optional();
  }
  return shape;
}

function toZodType(schema: JsonSchemaObject | undefined): z.ZodTypeAny {
  if (!schema) return z.any();
  const types = Array.isArray(schema.type)
    ? schema.type.filter((t): t is string => t !== 'null')
    : ([schema.type].filter(Boolean) as string[]);
  let zType: z.ZodTypeAny;
  switch (types[0]) {
    case 'string':
      zType = z.string();
      break;
    case 'number':
      zType = z.number();
      break;
    case 'integer':
      zType = z.number().int();
      break;
    case 'boolean':
      zType = z.boolean();
      break;
    case 'array':
      zType = z.array(toZodType(schema.items));
      break;
    case 'object':
      zType = z.object(toZodShape(schema));
      break;
    case 'null':
      zType = z.null();
      break;
    default:
      zType = z.any();
  }
  if (schema.description) zType = zType.describe(schema.description);
  if (schema.nullable) zType = zType.nullable();
  return zType;
}

const transport = new StdioServerTransport();
await server.connect(transport);
