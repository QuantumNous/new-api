import { describe, it, expect } from 'vitest';
import { z } from 'zod/v3';
import { parseCatchDef } from './catch';
import { getRefs } from '../refs';
import type { JSONSchema7 } from '@ai-sdk/provider';

describe('catch', () => {
  it('should be possible to use catch', () => {
    const parsedSchema = parseCatchDef(z.number().catch(5)._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'number',
    } satisfies JSONSchema7);
  });
});
