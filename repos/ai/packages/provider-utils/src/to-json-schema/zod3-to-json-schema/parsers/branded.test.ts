import { describe, it, expect } from 'vitest';
import { z } from 'zod/v3';
import { parseBrandedDef } from './branded';
import { getRefs } from '../refs';
import type { JSONSchema7 } from '@ai-sdk/provider';

describe('branded', () => {
  it('should be possible to use branded string', () => {
    const schema = z.string().brand<'x'>();
    const parsedSchema = parseBrandedDef(schema._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'string',
    } satisfies JSONSchema7);
  });
});
