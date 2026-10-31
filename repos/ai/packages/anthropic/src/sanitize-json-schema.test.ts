import type { JSONSchema7 } from '@ai-sdk/provider';
import { describe, expect, it } from 'vitest';
import { sanitizeJsonSchema } from './sanitize-json-schema';

describe('sanitizeJsonSchema', () => {
  it('strips unsupported number constraints and adds readable descriptions', () => {
    const schema: JSONSchema7 = {
      type: 'object',
      properties: {
        recurringIntervalMinutes: {
          type: 'number',
          exclusiveMinimum: 0,
          minimum: 1,
          maximum: 60,
          exclusiveMaximum: 120,
        },
      },
      required: ['recurringIntervalMinutes'],
      additionalProperties: false,
    };

    expect(sanitizeJsonSchema(schema)).toMatchInlineSnapshot(`
      {
        "additionalProperties": false,
        "properties": {
          "recurringIntervalMinutes": {
            "description": "minimum: 1; maximum: 60; exclusive minimum: 0; exclusive maximum: 120.",
            "type": "number",
          },
        },
        "required": [
          "recurringIntervalMinutes",
        ],
        "type": "object",
      }
    `);
  });

  it('strips unsupported string constraints and unsupported formats', () => {
    const schema: JSONSchema7 = {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description: 'A URL slug',
          minLength: 1,
          maxLength: 20,
          pattern: '^[a-z0-9-]+$',
          format: 'regex',
        },
      },
    };

    expect(sanitizeJsonSchema(schema)).toMatchInlineSnapshot(`
      {
        "additionalProperties": false,
        "properties": {
          "slug": {
            "description": "A URL slug
      min length: 1; max length: 20; pattern: ^[a-z0-9-]+$; format: regex.",
            "type": "string",
          },
        },
        "type": "object",
      }
    `);
  });

  it('recursively sanitizes arrays, definitions, and composition schemas', () => {
    const schema = {
      type: 'object',
      $defs: {
        PositiveInteger: {
          type: 'integer',
          minimum: 1,
        },
      },
      properties: {
        count: { $ref: '#/$defs/PositiveInteger' },
        tags: {
          type: 'array',
          minItems: 2,
          maxItems: 4,
          uniqueItems: true,
          items: {
            anyOf: [
              { type: 'string', minLength: 1 },
              { type: 'number', maximum: 10 },
            ],
          },
        },
      },
    } as JSONSchema7 & {
      $defs: Record<string, JSONSchema7>;
    };

    expect(sanitizeJsonSchema(schema)).toMatchInlineSnapshot(`
      {
        "$defs": {
          "PositiveInteger": {
            "description": "minimum: 1.",
            "type": "integer",
          },
        },
        "additionalProperties": false,
        "properties": {
          "count": {
            "$ref": "#/$defs/PositiveInteger",
          },
          "tags": {
            "description": "min items: 2; max items: 4; unique items: true.",
            "items": {
              "anyOf": [
                {
                  "description": "min length: 1.",
                  "type": "string",
                },
                {
                  "description": "maximum: 10.",
                  "type": "number",
                },
              ],
            },
            "type": "array",
          },
        },
        "type": "object",
      }
    `);
  });

  it('converts oneOf to anyOf', () => {
    const schema: JSONSchema7 = {
      oneOf: [
        { type: 'string', minLength: 1 },
        { type: 'number', minimum: 0 },
      ],
    };

    expect(sanitizeJsonSchema(schema)).toMatchInlineSnapshot(`
      {
        "anyOf": [
          {
            "description": "min length: 1.",
            "type": "string",
          },
          {
            "description": "minimum: 0.",
            "type": "number",
          },
        ],
      }
    `);
  });

  it('does not mutate the input schema', () => {
    const schema: JSONSchema7 = {
      type: 'object',
      properties: {
        value: { type: 'number', exclusiveMinimum: 0 },
      },
    };

    sanitizeJsonSchema(schema);

    expect(schema).toMatchInlineSnapshot(`
      {
        "properties": {
          "value": {
            "exclusiveMinimum": 0,
            "type": "number",
          },
        },
        "type": "object",
      }
    `);
  });
});
