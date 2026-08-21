import type { JSONSchema7 } from '@ai-sdk/provider';
import { describe, expect, it } from 'vitest';
import { addAdditionalPropertiesToJsonSchema } from './add-additional-properties-to-json-schema';

describe('addAdditionalPropertiesToJsonSchema', () => {
  it('adds additionalProperties: false to objects recursively', () => {
    const schema: JSONSchema7 = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
        },
        age: { type: 'number' },
      },
    };

    const result = addAdditionalPropertiesToJsonSchema(schema);

    expect(result).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: {
        user: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
          },
        },
        age: { type: 'number' },
      },
    });
  });

  it('adds additionalProperties: false to objects inside arrays', () => {
    const schema: JSONSchema7 = {
      type: 'object',
      properties: {
        ingredients: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              amount: { type: 'string' },
            },
            required: ['name', 'amount'],
          },
        },
      },
      required: ['ingredients'],
    };

    const result = addAdditionalPropertiesToJsonSchema(schema);

    expect(result).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: {
        ingredients: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string' },
              amount: { type: 'string' },
            },
            required: ['name', 'amount'],
          },
        },
      },
      required: ['ingredients'],
    });
  });

  it('adds additionalProperties: false when type is a union that includes "object"', () => {
    const schema: JSONSchema7 = {
      type: 'object',
      properties: {
        response: {
          type: ['object', 'null'],
          properties: {
            name: { type: 'string' },
          },
        },
      },
    };

    expect(addAdditionalPropertiesToJsonSchema(schema)).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: {
        response: {
          type: ['object', 'null'],
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
          },
        },
      },
    });
  });

  it('adds additionalProperties: false to objects inside anyOf', () => {
    const schema: JSONSchema7 = {
      type: 'object',
      properties: {
        response: {
          anyOf: [
            { type: 'object', properties: { name: { type: 'string' } } },
            { type: 'object', properties: { amount: { type: 'string' } } },
          ],
        },
      },
    };

    expect(addAdditionalPropertiesToJsonSchema(schema)).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: {
        response: {
          anyOf: [
            {
              type: 'object',
              additionalProperties: false,
              properties: { name: { type: 'string' } },
            },
            {
              type: 'object',
              additionalProperties: false,
              properties: { amount: { type: 'string' } },
            },
          ],
        },
      },
    });
  });

  it('adds additionalProperties: false to objects inside allOf', () => {
    const schema: JSONSchema7 = {
      type: 'object',
      properties: {
        response: {
          allOf: [
            { type: 'object', properties: { name: { type: 'string' } } },
            { type: 'object', properties: { age: { type: 'number' } } },
          ],
        },
      },
    };

    expect(addAdditionalPropertiesToJsonSchema(schema)).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: {
        response: {
          allOf: [
            {
              type: 'object',
              additionalProperties: false,
              properties: { name: { type: 'string' } },
            },
            {
              type: 'object',
              additionalProperties: false,
              properties: { age: { type: 'number' } },
            },
          ],
        },
      },
    });
  });

  it('adds additionalProperties: false to objects inside oneOf', () => {
    const schema: JSONSchema7 = {
      type: 'object',
      properties: {
        response: {
          oneOf: [
            { type: 'object', properties: { success: { type: 'boolean' } } },
            { type: 'object', properties: { error: { type: 'string' } } },
          ],
        },
      },
    };

    expect(addAdditionalPropertiesToJsonSchema(schema)).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: {
        response: {
          oneOf: [
            {
              type: 'object',
              additionalProperties: false,
              properties: { success: { type: 'boolean' } },
            },
            {
              type: 'object',
              additionalProperties: false,
              properties: { error: { type: 'string' } },
            },
          ],
        },
      },
    });
  });

  it('adds additionalProperties: false to object schemas inside definitions (refs)', () => {
    const schema: JSONSchema7 = {
      type: 'object',
      properties: {
        node: { $ref: '#/definitions/Node' },
      },
      definitions: {
        Node: {
          type: 'object',
          properties: {
            value: { type: 'string' },
            next: { $ref: '#/definitions/Node' }, // recursive reference
          },
        },
      },
    };

    expect(addAdditionalPropertiesToJsonSchema(schema)).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: {
        node: { $ref: '#/definitions/Node' },
      },
      definitions: {
        Node: {
          type: 'object',
          additionalProperties: false,
          properties: {
            value: { type: 'string' },
            next: { $ref: '#/definitions/Node' },
          },
        },
      },
    });
  });

  it('overwrites existing additionalProperties flags', () => {
    const schema: JSONSchema7 = {
      type: 'object',
      additionalProperties: true,
      properties: {
        meta: {
          type: 'object',
          additionalProperties: true,
          properties: {
            id: { type: 'string' },
          },
        },
      },
    };

    const result = addAdditionalPropertiesToJsonSchema(schema);

    expect(result).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: {
        meta: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
          },
        },
      },
    });
  });

  it('leaves non-object schemas unchanged', () => {
    const schema: JSONSchema7 = { type: 'string' };

    const result = addAdditionalPropertiesToJsonSchema(schema);

    expect(result).toBe(schema);
    expect(result).toEqual({ type: 'string' });
  });
});
