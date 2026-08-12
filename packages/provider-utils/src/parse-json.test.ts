import { describe, it, expect } from 'vitest';
import { parseJSON, safeParseJSON, isParsableJson } from './parse-json';
import { z } from 'zod/v4';
import { JSONParseError, TypeValidationError } from '@ai-sdk/provider';

describe('parseJSON', () => {
  it('should parse basic JSON without schema', async () => {
    const result = await parseJSON({ text: '{"foo": "bar"}' });
    expect(result).toEqual({ foo: 'bar' });
  });

  it('should parse JSON with schema validation', async () => {
    const schema = z.object({ foo: z.string() });
    const result = await parseJSON({ text: '{"foo": "bar"}', schema });
    expect(result).toEqual({ foo: 'bar' });
  });

  it('should throw JSONParseError for invalid JSON', async () => {
    await expect(() => parseJSON({ text: 'invalid json' })).rejects.toThrow(
      JSONParseError,
    );
  });

  it('should throw TypeValidationError for schema validation failures', async () => {
    const schema = z.object({ foo: z.number() });
    await expect(() =>
      parseJSON({ text: '{"foo": "bar"}', schema }),
    ).rejects.toThrow(TypeValidationError);
  });
});

describe('safeParseJSON', () => {
  it('should safely parse basic JSON without schema and include rawValue', async () => {
    const result = await safeParseJSON({ text: '{"foo": "bar"}' });
    expect(result).toEqual({
      success: true,
      value: { foo: 'bar' },
      rawValue: { foo: 'bar' },
    });
  });

  it('should preserve rawValue even after schema transformation', async () => {
    const schema = z.object({
      count: z.coerce.number(),
    });
    const result = await safeParseJSON({
      text: '{"count": "42"}',
      schema,
    });

    expect(result).toEqual({
      success: true,
      value: { count: 42 },
      rawValue: { count: '42' },
    });
  });

  it('should handle failed parsing with error details', async () => {
    const result = await safeParseJSON({ text: 'invalid json' });
    expect(result).toEqual({
      success: false,
      error: expect.any(JSONParseError),
    });
  });

  it('should handle schema validation failures', async () => {
    const schema = z.object({ age: z.number() });
    const result = await safeParseJSON({
      text: '{"age": "twenty"}',
      schema,
    });

    expect(result).toEqual({
      success: false,
      error: expect.any(TypeValidationError),
      rawValue: { age: 'twenty' },
    });
  });

  it('should handle nested objects and preserve raw values', async () => {
    const schema = z.object({
      user: z.object({
        id: z.string().transform(val => parseInt(val, 10)),
        name: z.string(),
      }),
    });

    const result = await safeParseJSON({
      text: '{"user": {"id": "123", "name": "John"}}',
      schema: schema as any,
    });

    expect(result).toEqual({
      success: true,
      value: { user: { id: 123, name: 'John' } },
      rawValue: { user: { id: '123', name: 'John' } },
    });
  });

  it('should handle arrays and preserve raw values', async () => {
    const schema = z.array(z.string().transform(val => val.toUpperCase()));
    const result = await safeParseJSON({
      text: '["hello", "world"]',
      schema,
    });

    expect(result).toEqual({
      success: true,
      value: ['HELLO', 'WORLD'],
      rawValue: ['hello', 'world'],
    });
  });

  it('should handle discriminated unions in schema', async () => {
    const schema = z.discriminatedUnion('type', [
      z.object({ type: z.literal('text'), content: z.string() }),
      z.object({ type: z.literal('number'), value: z.number() }),
    ]);

    const result = await safeParseJSON({
      text: '{"type": "text", "content": "hello"}',
      schema,
    });

    expect(result).toEqual({
      success: true,
      value: { type: 'text', content: 'hello' },
      rawValue: { type: 'text', content: 'hello' },
    });
  });

  it('should handle nullable fields in schema', async () => {
    const schema = z.object({
      id: z.string().nullish(),
      data: z.string(),
    });

    const result = await safeParseJSON({
      text: '{"id": null, "data": "test"}',
      schema,
    });

    expect(result).toEqual({
      success: true,
      value: { id: null, data: 'test' },
      rawValue: { id: null, data: 'test' },
    });
  });

  it('should handle union types in schema', async () => {
    const schema = z.object({
      value: z.union([z.string(), z.number()]),
    });

    const result1 = await safeParseJSON({
      text: '{"value": "test"}',
      schema,
    });

    const result2 = await safeParseJSON({
      text: '{"value": 123}',
      schema,
    });

    expect(result1).toEqual({
      success: true,
      value: { value: 'test' },
      rawValue: { value: 'test' },
    });

    expect(result2).toEqual({
      success: true,
      value: { value: 123 },
      rawValue: { value: 123 },
    });
  });
});

describe('isParsableJson', () => {
  it('should return true for valid JSON', () => {
    expect(isParsableJson('{"foo": "bar"}')).toBe(true);
    expect(isParsableJson('[1, 2, 3]')).toBe(true);
    expect(isParsableJson('"hello"')).toBe(true);
  });

  it('should return false for invalid JSON', () => {
    expect(isParsableJson('invalid')).toBe(false);
    expect(isParsableJson('{foo: "bar"}')).toBe(false);
    expect(isParsableJson('{"foo": }')).toBe(false);
  });
});
