import { describe, it, expect } from 'vitest';
import { z } from 'zod/v3';
import { parseUnionDef } from './union';
import { getRefs } from '../refs';
import type { JSONSchema7 } from '@ai-sdk/provider';

describe('union', () => {
  it('Should be possible to get a simple type array from a union of only unvalidated primitives', () => {
    const parsedSchema = parseUnionDef(
      z.union([z.string(), z.number(), z.boolean(), z.null()])._def,
      getRefs(),
    );

    expect(parsedSchema).toStrictEqual({
      type: ['string', 'number', 'boolean', 'null'],
    } satisfies JSONSchema7);
  });

  it('Should be possible to get a simple type array with enum values from a union of literals', () => {
    const parsedSchema = parseUnionDef(
      z.union([
        z.literal('string'),
        z.literal(123),
        z.literal(true),
        z.literal(null),
        z.literal(BigInt(50)),
      ])._def,
      getRefs(),
    );

    expect(parsedSchema).toStrictEqual({
      type: ['string', 'number', 'boolean', 'null', 'integer'],
      enum: ['string', 123, true, null, BigInt(50) as unknown as number],
    } satisfies JSONSchema7);
  });

  it('Should be possible to get an anyOf array with enum values from a union of literals', () => {
    const parsedSchema = parseUnionDef(
      z.union([
        z.literal(undefined),
        z.literal(Symbol('abc')),
        // @ts-expect-error Ok
        z.literal(function () {}),
      ])._def,
      getRefs(),
    );

    expect(parsedSchema).toStrictEqual({
      anyOf: [
        {
          type: 'object',
        },
        {
          type: 'object',
        },
        {
          type: 'object',
        },
      ],
    } satisfies JSONSchema7);
  });

  it('Should be possible to create a union with objects, arrays and validated primitives as an anyOf', () => {
    const parsedSchema = parseUnionDef(
      z.union([
        z.object({ herp: z.string(), derp: z.boolean() }),
        z.array(z.number()),
        z.string().min(3),
        z.number(),
      ])._def,
      getRefs(),
    );

    expect(parsedSchema).toStrictEqual({
      anyOf: [
        {
          type: 'object',
          properties: {
            herp: {
              type: 'string',
            },
            derp: {
              type: 'boolean',
            },
          },
          required: ['herp', 'derp'],
          additionalProperties: false,
        },
        {
          type: 'array',
          items: {
            type: 'number',
          },
        },
        {
          type: 'string',
          minLength: 3,
        },
        {
          type: 'number',
        },
      ],
    } satisfies JSONSchema7);
  });

  it('should be possible to deref union schemas', () => {
    const recurring = z.object({ foo: z.boolean() });

    const union = z.union([recurring, recurring, recurring]);

    const jsonSchema = parseUnionDef(union._def, getRefs());

    expect(jsonSchema).toStrictEqual({
      anyOf: [
        {
          type: 'object',
          properties: {
            foo: {
              type: 'boolean',
            },
          },
          required: ['foo'],
          additionalProperties: false,
        },
        {
          $ref: '#/anyOf/0',
        },
        {
          $ref: '#/anyOf/0',
        },
      ],
    } satisfies JSONSchema7);
  });

  it('nullable primitives should come out fine', () => {
    const union = z.union([z.string(), z.null()]);

    const jsonSchema = parseUnionDef(union._def, getRefs());

    expect(jsonSchema).toStrictEqual({
      type: ['string', 'null'],
    } satisfies JSONSchema7);
  });

  it('should join a union of Zod enums into a single enum', () => {
    const union = z.union([z.enum(['a', 'b', 'c']), z.enum(['c', 'd', 'e'])]);

    const jsonSchema = parseUnionDef(union._def, getRefs());

    expect(jsonSchema).toStrictEqual({
      type: 'string',
      enum: ['a', 'b', 'c', 'd', 'e'],
    } satisfies JSONSchema7);
  });

  it('should work with discriminated union type', () => {
    const discUnion = z.discriminatedUnion('kek', [
      z.object({ kek: z.literal('A'), lel: z.boolean() }),
      z.object({ kek: z.literal('B'), lel: z.number() }),
    ]);

    const jsonSchema = parseUnionDef(discUnion._def, getRefs());

    expect(jsonSchema).toStrictEqual({
      anyOf: [
        {
          type: 'object',
          properties: {
            kek: {
              type: 'string',
              const: 'A',
            },
            lel: {
              type: 'boolean',
            },
          },
          required: ['kek', 'lel'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            kek: {
              type: 'string',
              const: 'B',
            },
            lel: {
              type: 'number',
            },
          },
          required: ['kek', 'lel'],
          additionalProperties: false,
        },
      ],
    } satisfies JSONSchema7);
  });

  it('should not ignore descriptions in literal unions', () => {
    expect(
      parseUnionDef(
        z.union([z.literal(true), z.literal('herp'), z.literal(3)])._def,
        getRefs(),
      ),
    ).toStrictEqual({
      type: ['boolean', 'string', 'number'],
      enum: [true, 'herp', 3],
    } satisfies JSONSchema7);

    expect(
      parseUnionDef(
        z.union([
          z.literal(true),
          z.literal('herp').describe('derp'),
          z.literal(3),
        ])._def,
        getRefs(),
      ),
    ).toStrictEqual({
      anyOf: [
        { type: 'boolean', const: true },
        { type: 'string', const: 'herp', description: 'derp' },
        { type: 'number', const: 3 },
      ],
    } satisfies JSONSchema7);
  });
});
