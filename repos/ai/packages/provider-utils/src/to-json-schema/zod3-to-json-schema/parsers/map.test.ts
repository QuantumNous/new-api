import { describe, it, expect } from 'vitest';
import { z } from 'zod/v3';
import { parseMapDef } from './map';
import { getRefs } from '../refs';
import type { JSONSchema7 } from '@ai-sdk/provider';

describe('map', () => {
  it('should be possible to use Map', () => {
    const mapSchema = z.map(z.string(), z.number());

    const parsedSchema = parseMapDef(mapSchema._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'array',
      maxItems: 125,
      items: {
        type: 'array',
        items: [
          {
            type: 'string',
          },
          {
            type: 'number',
          },
        ],
        minItems: 2,
        maxItems: 2,
      },
    } satisfies JSONSchema7);
  });

  it('should be possible to use additionalProperties-pattern (record)', () => {
    expect(
      parseMapDef(
        z.map(z.string().min(1), z.number())._def,
        getRefs({ mapStrategy: 'record' }),
      ),
    ).toStrictEqual({
      type: 'object',
      additionalProperties: {
        type: 'number',
      },
      propertyNames: {
        minLength: 1,
      },
    } satisfies JSONSchema7);
  });
});
