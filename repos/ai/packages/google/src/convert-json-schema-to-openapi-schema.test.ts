import type { JSONSchema7 } from '@ai-sdk/provider';
import { convertJSONSchemaToOpenAPISchema } from './convert-json-schema-to-openapi-schema';
import { it, expect } from 'vitest';

it('should remove additionalProperties and $schema', () => {
  const input: JSONSchema7 = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
    },
    additionalProperties: false,
  };

  const expected = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
    },
  };

  expect(convertJSONSchemaToOpenAPISchema(input)).toEqual(expected);
});

it('should remove additionalProperties object from nested object schemas', function () {
  const input: JSONSchema7 = {
    type: 'object',
    properties: {
      keys: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: 'Description for the key',
      },
    },
    additionalProperties: false,
    $schema: 'http://json-schema.org/draft-07/schema#',
  };

  const expected = {
    type: 'object',
    properties: {
      keys: {
        type: 'object',
        description: 'Description for the key',
      },
    },
  };

  expect(convertJSONSchemaToOpenAPISchema(input)).toEqual(expected);
});

it('should handle nested objects and arrays', () => {
  const input: JSONSchema7 = {
    type: 'object',
    properties: {
      users: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  };

  const expected = {
    type: 'object',
    properties: {
      users: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
          },
        },
      },
    },
  };

  expect(convertJSONSchemaToOpenAPISchema(input)).toEqual(expected);
});

it('should convert "const" to "enum" with a single value', () => {
  const input: JSONSchema7 = {
    type: 'object',
    properties: {
      status: { const: 'active' },
    },
  };

  const expected = {
    type: 'object',
    properties: {
      status: { enum: ['active'] },
    },
  };

  expect(convertJSONSchemaToOpenAPISchema(input)).toEqual(expected);
});

it('should handle allOf, anyOf, and oneOf', () => {
  const input: JSONSchema7 = {
    type: 'object',
    properties: {
      allOfProp: { allOf: [{ type: 'string' }, { minLength: 5 }] },
      anyOfProp: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      oneOfProp: { oneOf: [{ type: 'boolean' }, { type: 'null' }] },
    },
  };

  const expected = {
    type: 'object',
    properties: {
      allOfProp: {
        allOf: [{ type: 'string' }, { minLength: 5 }],
      },
      anyOfProp: {
        anyOf: [{ type: 'string' }, { type: 'number' }],
      },
      oneOfProp: {
        oneOf: [{ type: 'boolean' }, { type: 'null' }],
      },
    },
  };

  expect(convertJSONSchemaToOpenAPISchema(input)).toEqual(expected);
});

it('should convert "format: date-time" to "format: date-time"', () => {
  const input: JSONSchema7 = {
    type: 'object',
    properties: {
      timestamp: { type: 'string', format: 'date-time' },
    },
  };

  const expected = {
    type: 'object',
    properties: {
      timestamp: { type: 'string', format: 'date-time' },
    },
  };

  expect(convertJSONSchemaToOpenAPISchema(input)).toEqual(expected);
});

it('should handle required properties', () => {
  const input: JSONSchema7 = {
    type: 'object',
    properties: {
      id: { type: 'number' },
      name: { type: 'string' },
    },
    required: ['id'],
  };

  const expected = {
    type: 'object',
    properties: {
      id: { type: 'number' },
      name: { type: 'string' },
    },
    required: ['id'],
  };

  expect(convertJSONSchemaToOpenAPISchema(input)).toEqual(expected);
});

it('should convert deeply nested "const" to "enum"', () => {
  const input: JSONSchema7 = {
    type: 'object',
    properties: {
      nested: {
        type: 'object',
        properties: {
          deeplyNested: {
            anyOf: [
              {
                type: 'object',
                properties: {
                  value: {
                    const: 'specific value',
                  },
                },
              },
              {
                type: 'string',
              },
            ],
          },
        },
      },
    },
  };

  const expected = {
    type: 'object',
    properties: {
      nested: {
        type: 'object',
        properties: {
          deeplyNested: {
            anyOf: [
              {
                type: 'object',
                properties: {
                  value: {
                    enum: ['specific value'],
                  },
                },
              },
              {
                type: 'string',
              },
            ],
          },
        },
      },
    },
  };

  expect(convertJSONSchemaToOpenAPISchema(input)).toEqual(expected);
});

it('should correctly convert a complex schema with nested const and anyOf', () => {
  const input: JSONSchema7 = {
    type: 'object',
    properties: {
      name: {
        type: 'string',
      },
      age: {
        type: 'number',
      },
      contact: {
        anyOf: [
          {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                const: 'email',
              },
              value: {
                type: 'string',
              },
            },
            required: ['type', 'value'],
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                const: 'phone',
              },
              value: {
                type: 'string',
              },
            },
            required: ['type', 'value'],
            additionalProperties: false,
          },
        ],
      },
      occupation: {
        anyOf: [
          {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                const: 'employed',
              },
              company: {
                type: 'string',
              },
              position: {
                type: 'string',
              },
            },
            required: ['type', 'company', 'position'],
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                const: 'student',
              },
              school: {
                type: 'string',
              },
              grade: {
                type: 'number',
              },
            },
            required: ['type', 'school', 'grade'],
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                const: 'unemployed',
              },
            },
            required: ['type'],
            additionalProperties: false,
          },
        ],
      },
    },
    required: ['name', 'age', 'contact', 'occupation'],
    additionalProperties: false,
    $schema: 'http://json-schema.org/draft-07/schema#',
  };

  const expected = {
    type: 'object',
    properties: {
      name: {
        type: 'string',
      },
      age: {
        type: 'number',
      },
      contact: {
        anyOf: [
          {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['email'],
              },
              value: {
                type: 'string',
              },
            },
            required: ['type', 'value'],
          },
          {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['phone'],
              },
              value: {
                type: 'string',
              },
            },
            required: ['type', 'value'],
          },
        ],
      },
      occupation: {
        anyOf: [
          {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['employed'],
              },
              company: {
                type: 'string',
              },
              position: {
                type: 'string',
              },
            },
            required: ['type', 'company', 'position'],
          },
          {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['student'],
              },
              school: {
                type: 'string',
              },
              grade: {
                type: 'number',
              },
            },
            required: ['type', 'school', 'grade'],
          },
          {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['unemployed'],
              },
            },
            required: ['type'],
          },
        ],
      },
    },
    required: ['name', 'age', 'contact', 'occupation'],
  };

  expect(convertJSONSchemaToOpenAPISchema(input)).toEqual(expected);
});

it('should handle null type correctly', () => {
  const input: JSONSchema7 = {
    type: 'object',
    properties: {
      nullableField: {
        type: ['string', 'null'],
      },
      explicitNullField: {
        type: 'null',
      },
    },
  };

  const expected = {
    type: 'object',
    properties: {
      nullableField: {
        anyOf: [{ type: 'string' }],
        nullable: true,
      },
      explicitNullField: {
        type: 'null',
      },
    },
  };

  expect(convertJSONSchemaToOpenAPISchema(input)).toEqual(expected);
});

it('should handle descriptions', () => {
  const input: JSONSchema7 = {
    type: 'object',
    description: 'A user object',
    properties: {
      id: {
        type: 'number',
        description: 'The user ID',
      },
      name: {
        type: 'string',
        description: "The user's full name",
      },
      email: {
        type: 'string',
        format: 'email',
        description: "The user's email address",
      },
    },
    required: ['id', 'name'],
  };

  const expected = {
    type: 'object',
    description: 'A user object',
    properties: {
      id: {
        type: 'number',
        description: 'The user ID',
      },
      name: {
        type: 'string',
        description: "The user's full name",
      },
      email: {
        type: 'string',
        format: 'email',
        description: "The user's email address",
      },
    },
    required: ['id', 'name'],
  };

  expect(convertJSONSchemaToOpenAPISchema(input)).toEqual(expected);
});

it('should return undefined for empty object schemas at root level', () => {
  const emptyObjectSchemas = [
    { type: 'object' },
    { type: 'object', properties: {} },
  ] as const;

  emptyObjectSchemas.forEach(schema => {
    expect(convertJSONSchemaToOpenAPISchema(schema)).toBeUndefined();
  });
});

it('should preserve nested empty object schemas to avoid breaking required array validation', () => {
  const input: JSONSchema7 = {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to navigate to' },
      launchOptions: {
        type: 'object',
        description: 'PuppeteerJS LaunchOptions',
      },
      allowDangerous: {
        type: 'boolean',
        description: 'Allow dangerous options',
      },
    },
    required: ['url', 'launchOptions'],
  };

  const expected = {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to navigate to' },
      launchOptions: {
        type: 'object',
        description: 'PuppeteerJS LaunchOptions',
      },
      allowDangerous: {
        type: 'boolean',
        description: 'Allow dangerous options',
      },
    },
    required: ['url', 'launchOptions'],
  };

  expect(convertJSONSchemaToOpenAPISchema(input)).toEqual(expected);
});

it('should preserve nested empty object schemas without descriptions', () => {
  const input: JSONSchema7 = {
    type: 'object',
    properties: {
      options: { type: 'object' },
    },
    required: ['options'],
  };

  const expected = {
    type: 'object',
    properties: {
      options: { type: 'object' },
    },
    required: ['options'],
  };

  expect(convertJSONSchemaToOpenAPISchema(input)).toEqual(expected);
});

it('should handle non-empty object schemas', () => {
  const nonEmptySchema: JSONSchema7 = {
    type: 'object',
    properties: {
      name: { type: 'string' },
    },
  };

  expect(convertJSONSchemaToOpenAPISchema(nonEmptySchema)).toEqual({
    type: 'object',
    properties: {
      name: { type: 'string' },
    },
  });
});

it('should convert string enum properties', () => {
  const schemaWithEnumProperty: JSONSchema7 = {
    type: 'object',
    properties: {
      kind: {
        type: 'string',
        enum: ['text', 'code', 'image'],
      },
    },
    required: ['kind'],
    additionalProperties: false,
    $schema: 'http://json-schema.org/draft-07/schema#',
  };

  expect(convertJSONSchemaToOpenAPISchema(schemaWithEnumProperty)).toEqual({
    type: 'object',
    properties: {
      kind: {
        type: 'string',
        enum: ['text', 'code', 'image'],
      },
    },
    required: ['kind'],
  });
});

it('should convert nullable string enum', () => {
  const schemaWithEnumProperty: JSONSchema7 = {
    type: 'object',
    properties: {
      fieldD: {
        anyOf: [
          {
            type: 'string',
            enum: ['a', 'b', 'c'],
          },
          {
            type: 'null',
          },
        ],
      },
    },
    required: ['fieldD'],
    additionalProperties: false,
    $schema: 'http://json-schema.org/draft-07/schema#',
  };

  expect(convertJSONSchemaToOpenAPISchema(schemaWithEnumProperty)).toEqual({
    required: ['fieldD'],
    type: 'object',
    properties: {
      fieldD: {
        nullable: true,
        type: 'string',
        enum: ['a', 'b', 'c'],
      },
    },
  });
});

it('should handle type arrays with multiple non-null types plus null', () => {
  const input: JSONSchema7 = {
    type: 'object',
    properties: {
      multiTypeField: {
        type: ['string', 'number', 'null'],
      },
    },
  };

  const expected = {
    type: 'object',
    properties: {
      multiTypeField: {
        anyOf: [{ type: 'string' }, { type: 'number' }],
        nullable: true,
      },
    },
  };

  expect(convertJSONSchemaToOpenAPISchema(input)).toEqual(expected);
});

it('should convert type arrays without null to anyOf', () => {
  const input: JSONSchema7 = {
    type: 'object',
    properties: {
      multiTypeField: {
        type: ['string', 'number'],
      },
    },
  };

  const expected = {
    type: 'object',
    properties: {
      multiTypeField: {
        anyOf: [{ type: 'string' }, { type: 'number' }],
      },
    },
  };

  expect(convertJSONSchemaToOpenAPISchema(input)).toEqual(expected);
});
