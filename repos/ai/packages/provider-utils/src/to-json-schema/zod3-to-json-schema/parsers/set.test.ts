import { describe, it, expect } from 'vitest';
import type { JSONSchema7 } from '@ai-sdk/provider';
import { z } from 'zod/v3';
import { getRefs } from '../refs';
import { parseSetDef } from './set';

describe('set', () => {
  it('should map set', () => {
    const zodSchema = z.set(z.any()).min(5).max(10);
    const jsonParsedSchema = parseSetDef(zodSchema._def, getRefs());

    expect(jsonParsedSchema).toStrictEqual({
      type: 'array',
      minItems: 5,
      maxItems: 10,
      uniqueItems: true,
      items: {},
    } satisfies JSONSchema7);
  });
});
