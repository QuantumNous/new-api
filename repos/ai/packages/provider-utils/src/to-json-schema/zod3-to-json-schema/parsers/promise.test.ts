import { describe, it, expect } from 'vitest';
import { z } from 'zod/v3';
import { parsePromiseDef } from './promise';
import { getRefs } from '../refs';
import type { JSONSchema7 } from '@ai-sdk/provider';

describe('promise', () => {
  it('should be possible to use promise', () => {
    const parsedSchema = parsePromiseDef(z.promise(z.string())._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'string',
    } satisfies JSONSchema7);
  });
});
