import { describe, expect, it } from 'vitest';
import { jsonSchemaToZodObject } from './json-schema-to-zod';

describe('jsonSchemaToZodObject', () => {
  it('handles flat scalar properties with required/optional', () => {
    const schema = jsonSchemaToZodObject({
      type: 'object',
      properties: { city: { type: 'string' }, days: { type: 'integer' } },
      required: ['city'],
    });
    expect(schema.safeParse({ city: 'Paris' }).success).toBe(true);
    expect(schema.safeParse({ city: 'Paris', days: 3 }).success).toBe(true);
    expect(schema.safeParse({ days: 3 }).success).toBe(false);
    expect(schema.safeParse({ city: 'Paris', days: 1.5 }).success).toBe(false);
  });

  it('preserves nested object structure (the flat converter dropped this)', () => {
    const schema = jsonSchemaToZodObject({
      type: 'object',
      properties: {
        filter: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            limit: { type: 'number' },
          },
          required: ['status'],
        },
      },
      required: ['filter'],
    });
    expect(
      schema.safeParse({ filter: { status: 'open', limit: 10 } }).success,
    ).toBe(true);
    // nested required field enforced — impossible with the old z.record(unknown)
    expect(schema.safeParse({ filter: { limit: 10 } }).success).toBe(false);
    expect(schema.safeParse({ filter: { status: 5 } }).success).toBe(false);
  });

  it('preserves array item types', () => {
    const schema = jsonSchemaToZodObject({
      type: 'object',
      properties: { tags: { type: 'array', items: { type: 'string' } } },
      required: ['tags'],
    });
    expect(schema.safeParse({ tags: ['a', 'b'] }).success).toBe(true);
    expect(schema.safeParse({ tags: [1, 2] }).success).toBe(false);
  });

  it('supports arrays of objects', () => {
    const schema = jsonSchemaToZodObject({
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'integer' } },
            required: ['id'],
          },
        },
      },
    });
    expect(schema.safeParse({ items: [{ id: 1 }] }).success).toBe(true);
    expect(schema.safeParse({ items: [{ id: 'x' }] }).success).toBe(false);
  });

  it('honors nullable', () => {
    const schema = jsonSchemaToZodObject({
      type: 'object',
      properties: { note: { type: 'string', nullable: true } },
      required: ['note'],
    });
    expect(schema.safeParse({ note: null }).success).toBe(true);
    expect(schema.safeParse({ note: 'hi' }).success).toBe(true);
  });

  it('returns an empty object schema for a missing/!object input', () => {
    expect(jsonSchemaToZodObject(undefined).safeParse({}).success).toBe(true);
  });
});
