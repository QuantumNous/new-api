import { describe, it, expect } from 'vitest';
import { z } from 'zod/v3';
import { parseTupleDef } from './tuple';
import { getRefs } from '../refs';
import type { JSONSchema7 } from '@ai-sdk/provider';

describe('tuple', () => {
  it('should be possible to describe a simple tuple schema', () => {
    const schema = z.tuple([z.string(), z.number()]);
    const parsedSchema = parseTupleDef(schema._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'array',
      items: [{ type: 'string' }, { type: 'number' }],
      minItems: 2,
      maxItems: 2,
    } satisfies JSONSchema7);
  });

  it('should be possible to describe a tuple schema with rest()', () => {
    const schema = z.tuple([z.string(), z.number()]).rest(z.boolean());
    const parsedSchema = parseTupleDef(schema._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'array',
      items: [{ type: 'string' }, { type: 'number' }],
      minItems: 2,
      additionalItems: {
        type: 'boolean',
      },
    } satisfies JSONSchema7);
  });
});
