import { describe, it, expect } from 'vitest';
import { z } from 'zod/v3';
import { parseReadonlyDef } from './readonly';
import { getRefs } from '../refs';
import type { JSONSchema7 } from '@ai-sdk/provider';

describe('readonly', () => {
  it('should be possible to use readonly', () => {
    const parsedSchema = parseReadonlyDef(
      z.object({}).readonly()._def,
      getRefs(),
    );

    expect(parsedSchema).toStrictEqual({
      type: 'object',
      properties: {},
      additionalProperties: false,
    } satisfies JSONSchema7);
  });
});
