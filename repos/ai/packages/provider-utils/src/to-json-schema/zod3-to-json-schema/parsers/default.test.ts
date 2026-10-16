import { describe, it, expect } from 'vitest';
import { z } from 'zod/v3';
import { parseDefaultDef } from './default';
import { getRefs } from '../refs';
import type { JSONSchema7 } from '@ai-sdk/provider';

describe('default', () => {
  it('should be possible to use default on objects', () => {
    const parsedSchema = parseDefaultDef(
      z.object({ foo: z.boolean() }).default({ foo: true })._def,
      getRefs(),
    );

    expect(parsedSchema).toStrictEqual({
      type: 'object',
      additionalProperties: false,
      required: ['foo'],
      properties: {
        foo: {
          type: 'boolean',
        },
      },
      default: {
        foo: true,
      },
    } satisfies JSONSchema7);
  });

  it('should be possible to use default on primitives', () => {
    const parsedSchema = parseDefaultDef(
      z.string().default('default')._def,
      getRefs(),
    );

    expect(parsedSchema).toStrictEqual({
      type: 'string',
      default: 'default',
    } satisfies JSONSchema7);
  });

  it('default with transform', () => {
    const stringWithDefault = z
      .string()
      .transform(val => val.toUpperCase())
      .default('default');

    const parsedSchema = parseDefaultDef(stringWithDefault._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'string',
      default: 'default',
    } satisfies JSONSchema7);
  });
});
