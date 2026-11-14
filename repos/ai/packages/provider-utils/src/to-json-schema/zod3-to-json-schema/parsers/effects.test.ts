import { describe, it, expect, test } from 'vitest';
import { z } from 'zod/v3';
import { parseEffectsDef } from './effects';
import { getRefs } from '../refs';
import type { JSONSchema7 } from '@ai-sdk/provider';

describe('effects', () => {
  it('should be possible to use refine', () => {
    const parsedSchema = parseEffectsDef(
      z.number().refine(x => x + 1)._def,
      getRefs(),
    );

    expect(parsedSchema).toStrictEqual({
      type: 'number',
    } satisfies JSONSchema7);
  });

  it('should default to the input type', () => {
    const schema = z.string().transform(arg => parseInt(arg));

    const jsonSchema = parseEffectsDef(schema._def, getRefs());

    expect(jsonSchema).toStrictEqual({
      type: 'string',
    } satisfies JSONSchema7);
  });

  test("should return object based on 'any' strategy", () => {
    const schema = z.string().transform(arg => parseInt(arg));

    const jsonSchema = parseEffectsDef(
      schema._def,
      getRefs({
        effectStrategy: 'any',
      }),
    );

    expect(jsonSchema).toStrictEqual({} satisfies JSONSchema7);
  });
});
