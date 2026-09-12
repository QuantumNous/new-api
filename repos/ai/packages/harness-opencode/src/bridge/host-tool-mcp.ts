#!/usr/bin/env node
/*
 * These bridge imports are externalized by tsup and resolved inside the
 * sandbox from src/bridge/package.json and its lockfile. Keep this file,
 * tsup.config.ts, and the bridge package dependency list in sync.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod/v4';

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

type ZodShape = Record<string, z.ZodTypeAny>;

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

function toZodShape(schema: JsonSchemaObject | undefined): ZodShape {
  if (!schema?.properties) return {};
  const required = new Set(schema.required ?? []);
  const shape: ZodShape = {};
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
