import { z } from 'zod/v4';

export type JsonSchemaObject = {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchemaObject>;
  required?: string[];
  items?: JsonSchemaObject;
  nullable?: boolean;
};

// Convert a host tool's JSON Schema to a zod object for LangChain's `tool()`.
export function jsonSchemaToZodObject(input: unknown) {
  const schema =
    input && typeof input === 'object' ? (input as JsonSchemaObject) : {};
  return z.object(toZodShape(schema));
}

function toZodShape(schema: JsonSchemaObject): Record<string, z.ZodTypeAny> {
  if (!schema.properties) return {};
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
    ? schema.type.filter(t => t !== 'null')
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
