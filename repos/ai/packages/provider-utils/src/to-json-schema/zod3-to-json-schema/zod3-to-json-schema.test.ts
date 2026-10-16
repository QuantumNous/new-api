import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JSONSchema7 } from '@ai-sdk/provider';
import { z } from 'zod/v3';
import {
  ignoreOverride,
  jsonDescription,
  type PostProcessCallback,
} from './options';
import { zod3ToJsonSchema } from './zod3-to-json-schema';
import { delay } from '../../delay';

describe('zod3-to-json-schema', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('override', () => {
    it('the readme example', () => {
      expect(
        zod3ToJsonSchema(
          z.object({
            ignoreThis: z.string(),
            overrideThis: z.string(),
            removeThis: z.string(),
          }),
          {
            override: (def, refs) => {
              const path = refs.currentPath.join('/');

              if (path === '#/properties/overrideThis') {
                return {
                  type: 'integer',
                };
              }

              if (path === '#/properties/removeThis') {
                return undefined;
              }

              // Important! Do not return `undefined` or void unless you want to remove the property from the resulting schema completely.
              return ignoreOverride;
            },
          },
        ),
      ).toStrictEqual({
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        required: ['ignoreThis', 'overrideThis'],
        properties: {
          ignoreThis: {
            type: 'string',
          },
          overrideThis: {
            type: 'integer',
          },
        },
        additionalProperties: false,
      });
    });
  });

  describe('postProcess', () => {
    it('the readme example', () => {
      const zodSchema = z.object({
        myString: z.string().describe(
          JSON.stringify({
            title: 'My string',
            description: 'My description',
            examples: ['Foo', 'Bar'],
          }),
        ),
        myNumber: z.number(),
      });

      // Define the callback to be used to process the output using the PostProcessCallback type:
      const postProcess: PostProcessCallback = (
        // The original output produced by the package itself:
        jsonSchema,
        // The ZodSchema def used to produce the original schema:
        def,
        // The refs object containing the current path, passed options, etc.
        refs,
      ) => {
        if (!jsonSchema) {
          return jsonSchema;
        }

        // Try to expand description as JSON meta:
        if (jsonSchema.description) {
          try {
            jsonSchema = {
              ...jsonSchema,
              ...JSON.parse(jsonSchema.description),
            };
          } catch {}
        }

        // Make all numbers nullable:
        if ('type' in jsonSchema! && jsonSchema.type === 'number') {
          jsonSchema.type = ['number', 'null'];
        }

        // Add the refs path, just because
        (jsonSchema as any).path = refs.currentPath;

        return jsonSchema;
      };

      const jsonSchemaResult = zod3ToJsonSchema(zodSchema, {
        postProcess,
      });

      expect(jsonSchemaResult).toStrictEqual({
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        required: ['myString', 'myNumber'],
        properties: {
          myString: {
            type: 'string',
            title: 'My string',
            description: 'My description',
            examples: ['Foo', 'Bar'],
            path: ['#', 'properties', 'myString'],
          },
          myNumber: {
            type: ['number', 'null'],
            path: ['#', 'properties', 'myNumber'],
          },
        },
        additionalProperties: false,
        path: ['#'],
      });
    });

    it('expanding description json', () => {
      const zodSchema = z.string().describe(
        JSON.stringify({
          title: 'My string',
          description: 'My description',
          examples: ['Foo', 'Bar'],
          whatever: 123,
        }),
      );

      const jsonSchemaResult = zod3ToJsonSchema(zodSchema, {
        postProcess: jsonDescription,
      });

      expect(jsonSchemaResult).toStrictEqual({
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'string',
        title: 'My string',
        description: 'My description',
        examples: ['Foo', 'Bar'],
        whatever: 123,
      });
    });
  });

  it('should return the schema directly in the root if no name is passed', () => {
    expect(zod3ToJsonSchema(z.any())).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
    } satisfies JSONSchema7);
  });

  it('should return the schema inside a named property in "definitions" if a name is passed', () => {
    expect(zod3ToJsonSchema(z.any(), 'MySchema')).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      $ref: `#/definitions/MySchema`,
      definitions: {
        MySchema: {},
      },
    } satisfies JSONSchema7);
  });

  it('should return the schema inside a named property in "$defs" if a name and definitionPath is passed in options', () => {
    expect(
      zod3ToJsonSchema(z.any(), { name: 'MySchema', definitionPath: '$defs' }),
    ).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      $ref: `#/$defs/MySchema`,
      $defs: {
        MySchema: {},
      },
    } satisfies JSONSchema7);
  });

  it("should not scrub 'any'-schemas from unions when strictUnions=false", () => {
    expect(
      zod3ToJsonSchema(
        z.union([z.any(), z.instanceof(String), z.string(), z.number()]),
        { strictUnions: false },
      ),
    ).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      anyOf: [{}, {}, { type: 'string' }, { type: 'number' }],
    } satisfies JSONSchema7);
  });

  it("should scrub 'any'-schemas from unions when strictUnions=true", () => {
    expect(
      zod3ToJsonSchema(
        z.union([z.any(), z.instanceof(String), z.string(), z.number()]),
        { strictUnions: true },
      ),
    ).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      anyOf: [{ type: 'string' }, { type: 'number' }],
    } satisfies JSONSchema7);
  });

  it("should scrub 'any'-schemas from unions when strictUnions=true in objects", () => {
    expect(
      zod3ToJsonSchema(
        z.object({
          field: z.union([
            z.any(),
            z.instanceof(String),
            z.string(),
            z.number(),
          ]),
        }),
        { strictUnions: true },
      ),
    ).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      additionalProperties: false,
      properties: {
        field: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      },
      type: 'object',
    } satisfies JSONSchema7);
  });

  it('Definitions play nice with named schemas', () => {
    const MySpecialStringSchema = z.string();
    const MyArraySchema = z.array(MySpecialStringSchema);

    const result = zod3ToJsonSchema(MyArraySchema, {
      definitions: {
        MySpecialStringSchema,
        MyArraySchema,
      },
    });

    expect(result).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      $ref: '#/definitions/MyArraySchema',
      definitions: {
        MySpecialStringSchema: { type: 'string' },
        MyArraySchema: {
          type: 'array',
          items: {
            $ref: '#/definitions/MySpecialStringSchema',
          },
        },
      },
    } satisfies JSONSchema7);
  });

  it('should be possible to add name as title instead of as ref', () => {
    expect(
      zod3ToJsonSchema(z.string(), { name: 'hello', nameStrategy: 'title' }),
    ).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'string',
      title: 'hello',
    } satisfies JSONSchema7);
  });

  it('should be possible to use description', () => {
    const parsedSchema = zod3ToJsonSchema(
      z.string().describe('My neat string'),
    );

    expect(parsedSchema).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'string',
      description: 'My neat string',
    } satisfies JSONSchema7);
  });

  it('should handle optional schemas with different descriptions', () => {
    const recurringSchema = z.object({});
    const zodSchema = z
      .object({
        p1: recurringSchema.optional().describe('aaaaaaaaa'),
        p2: recurringSchema.optional().describe('bbbbbbbbb'),
        p3: recurringSchema.optional().describe('ccccccccc'),
      })
      .describe('sssssssss');

    const jsonSchema = zod3ToJsonSchema(zodSchema, {
      $refStrategy: 'none',
    });

    expect(jsonSchema).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      additionalProperties: false,
      description: 'sssssssss',
      properties: {
        p1: {
          additionalProperties: false,
          description: 'aaaaaaaaa',
          properties: {},
          type: 'object',
        },
        p2: {
          additionalProperties: false,
          description: 'bbbbbbbbb',
          properties: {},
          type: 'object',
        },
        p3: {
          additionalProperties: false,
          description: 'ccccccccc',
          properties: {},
          type: 'object',
        },
      },
      type: 'object',
    } satisfies JSONSchema7);
  });

  it('should be possible to use superRefine', () => {
    const schema = z.object({
      test: z
        .string()
        .optional()
        .superRefine(async (value, ctx) => {
          await delay(100);
          if (value === 'fail') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'This is a test error',
            });
          }
        }),
    });

    const output = zod3ToJsonSchema(schema);

    expect(output).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: { test: { type: 'string' } },
      additionalProperties: false,
    } satisfies JSONSchema7);
  });

  it('should be possible to use describe on arrays', () => {
    const topicSchema = z.object({
      topics: z
        .array(
          z.object({
            topic: z.string().describe('The topic of the position'),
          }),
        )
        .describe('An array of topics'),
    });

    const res = zod3ToJsonSchema(topicSchema);

    expect(res).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      required: ['topics'],
      properties: {
        topics: {
          type: 'array',
          items: {
            type: 'object',
            required: ['topic'],
            properties: {
              topic: {
                type: 'string',
                description: 'The topic of the position',
              },
            },
            additionalProperties: false,
          },
          description: 'An array of topics',
        },
      },
      additionalProperties: false,
    } satisfies JSONSchema7);
  });

  it('should be possible to use regex with error messages', () => {
    const urlRegex =
      /^((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=+$,\w]+@)?[A-Za-z0-9.-]+|(?:www\.|[-;:&=+$,\w]+@)[A-Za-z0-9.-]+)((?:\/[+~%,/.\w\-_]*)?\??(?:[-+=&;%@.\w:()_]*)#?(?:[.!/\\\w]*))?)/;

    const URLSchema = z
      .string()
      .min(1)
      .max(1000)
      .regex(urlRegex, { message: 'Please enter a valid URL' })
      .brand('url');

    const jsonSchemaJs = zod3ToJsonSchema(URLSchema, { errorMessages: true });
    const jsonSchema = JSON.parse(JSON.stringify(jsonSchemaJs));

    expect(jsonSchema).toStrictEqual({
      type: 'string',
      minLength: 1,
      maxLength: 1000,
      pattern:
        '^((([A-Za-z]{3,9}:(?:\\/\\/)?)(?:[-;:&=+$,\\w]+@)?[A-Za-z0-9.-]+|(?:www\\.|[-;:&=+$,\\w]+@)[A-Za-z0-9.-]+)((?:\\/[+~%,/.\\w\\-_]*)?\\??(?:[-+=&;%@.\\w:()_]*)#?(?:[.!/\\\\\\w]*))?)',
      $schema: 'http://json-schema.org/draft-07/schema#',
    } satisfies JSONSchema7);
  });

  it('should be possible to use lazy recursion @162', () => {
    const A: any = z.object({
      ref1: z.lazy(() => B),
    });

    const B = z.object({
      ref1: A,
    });

    const result = zod3ToJsonSchema(A);

    expect(result).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        ref1: {
          type: 'object',
          properties: {
            ref1: {
              $ref: '#',
            },
          },
          required: ['ref1'],
          additionalProperties: false,
        },
      },
      required: ['ref1'],
      additionalProperties: false,
    } satisfies JSONSchema7);
  });

  it('should produce valid json schema for all parsers', () => {
    enum nativeEnum {
      'a',
      'b',
      'c',
    }

    const allParsersSchema = z
      .object({
        any: z.any(),
        array: z.array(z.any()),
        arrayMin: z.array(z.any()).min(1),
        arrayMax: z.array(z.any()).max(1),
        arrayMinMax: z.array(z.any()).min(1).max(1),
        bigInt: z.bigint(),
        boolean: z.boolean(),
        date: z.date(),
        default: z.any().default(42),
        effectRefine: z.string().refine(x => x + x),
        effectTransform: z.string().transform(x => !!x),
        effectPreprocess: z.preprocess(x => {
          try {
            return JSON.stringify(x);
          } catch {
            return 'wahh';
          }
        }, z.string()),
        enum: z.enum(['hej', 'svejs']),
        intersection: z.intersection(z.string().min(1), z.string().max(4)),
        literal: z.literal('hej'),
        map: z.map(z.string().uuid(), z.boolean()),
        nativeEnum: z.nativeEnum(nativeEnum),
        never: z.never() as any,
        null: z.null(),
        nullablePrimitive: z.string().nullable(),
        nullableObject: z.object({ hello: z.string() }).nullable(),
        number: z.number(),
        numberGt: z.number().gt(1),
        numberLt: z.number().lt(1),
        numberGtLt: z.number().gt(1).lt(1),
        numberGte: z.number().gte(1),
        numberLte: z.number().lte(1),
        numberGteLte: z.number().gte(1).lte(1),
        numberMultipleOf: z.number().multipleOf(2),
        numberInt: z.number().int(),
        objectPasstrough: z
          .object({ foo: z.string(), bar: z.number().optional() })
          .passthrough(),
        objectCatchall: z
          .object({ foo: z.string(), bar: z.number().optional() })
          .catchall(z.boolean()),
        objectStrict: z
          .object({ foo: z.string(), bar: z.number().optional() })
          .strict(),
        objectStrip: z
          .object({ foo: z.string(), bar: z.number().optional() })
          .strip(),
        promise: z.promise(z.string()),
        recordStringBoolean: z.record(z.string(), z.boolean()),
        recordUuidBoolean: z.record(z.string().uuid(), z.boolean()),
        recordBooleanBoolean: z.record(z.boolean(), z.boolean()),
        set: z.set(z.string()),
        string: z.string(),
        stringMin: z.string().min(1),
        stringMax: z.string().max(1),
        stringEmail: z.string().email(),
        stringEmoji: z.string().emoji(),
        stringUrl: z.string().url(),
        stringUuid: z.string().uuid(),
        stringRegEx: z.string().regex(new RegExp('abc')),
        stringCuid: z.string().cuid(),
        tuple: z.tuple([z.string(), z.number(), z.boolean()]),
        undefined: z.undefined(),
        unionPrimitives: z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.bigint(),
          z.null(),
        ]),
        unionPrimitiveLiterals: z.union([
          z.literal(123),
          z.literal('abc'),
          z.literal(null),
          z.literal(true),
          // z.literal(1n), // target es2020
        ]),
        unionNonPrimitives: z.union([
          z.string(),
          z.object({
            foo: z.string(),
            bar: z.number().optional(),
          }),
        ]),
        unknown: z.unknown(),
      })
      .partial()
      .default({ string: 'hello' })
      .describe('watup');

    expect(zod3ToJsonSchema(allParsersSchema)).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        any: {},
        array: {
          type: 'array',
        },
        arrayMin: {
          type: 'array',
          minItems: 1,
        },
        arrayMax: {
          type: 'array',
          maxItems: 1,
        },
        arrayMinMax: {
          type: 'array',
          minItems: 1,
          maxItems: 1,
        },
        bigInt: {
          type: 'integer',
          format: 'int64',
        },
        boolean: {
          type: 'boolean',
        },
        date: {
          type: 'string',
          format: 'date-time',
        },
        default: {
          default: 42,
        },
        effectRefine: {
          type: 'string',
        },
        effectTransform: {
          type: 'string',
        },
        effectPreprocess: {
          type: 'string',
        },
        enum: {
          type: 'string',
          enum: ['hej', 'svejs'],
        },
        intersection: {
          allOf: [
            {
              type: 'string',
              minLength: 1,
            },
            {
              type: 'string',
              maxLength: 4,
            },
          ],
        },
        literal: {
          type: 'string',
          const: 'hej',
        },
        map: {
          type: 'array',
          maxItems: 125,
          items: {
            type: 'array',
            items: [
              {
                type: 'string',
                format: 'uuid',
              },
              {
                type: 'boolean',
              },
            ],
            minItems: 2,
            maxItems: 2,
          },
        },
        nativeEnum: {
          type: 'number',
          enum: [0, 1, 2],
        },
        never: {
          not: {},
        },
        null: {
          type: 'null',
        },
        nullablePrimitive: {
          type: ['string', 'null'],
        },
        nullableObject: {
          anyOf: [
            {
              type: 'object',
              properties: {
                hello: {
                  type: 'string',
                },
              },
              required: ['hello'],
              additionalProperties: false,
            },
            {
              type: 'null',
            },
          ],
        },
        number: {
          type: 'number',
        },
        numberGt: {
          type: 'number',
          exclusiveMinimum: 1,
        },
        numberLt: {
          type: 'number',
          exclusiveMaximum: 1,
        },
        numberGtLt: {
          type: 'number',
          exclusiveMinimum: 1,
          exclusiveMaximum: 1,
        },
        numberGte: {
          type: 'number',
          minimum: 1,
        },
        numberLte: {
          type: 'number',
          maximum: 1,
        },
        numberGteLte: {
          type: 'number',
          minimum: 1,
          maximum: 1,
        },
        numberMultipleOf: {
          type: 'number',
          multipleOf: 2,
        },
        numberInt: {
          type: 'integer',
        },
        objectPasstrough: {
          type: 'object',
          properties: {
            foo: {
              type: 'string',
            },
            bar: {
              type: 'number',
            },
          },
          required: ['foo'],
          additionalProperties: true,
        },
        objectCatchall: {
          type: 'object',
          properties: {
            foo: {
              type: 'string',
            },
            bar: {
              type: 'number',
            },
          },
          required: ['foo'],
          additionalProperties: {
            type: 'boolean',
          },
        },
        objectStrict: {
          type: 'object',
          properties: {
            foo: {
              type: 'string',
            },
            bar: {
              type: 'number',
            },
          },
          required: ['foo'],
          additionalProperties: false,
        },
        objectStrip: {
          type: 'object',
          properties: {
            foo: {
              type: 'string',
            },
            bar: {
              type: 'number',
            },
          },
          required: ['foo'],
          additionalProperties: false,
        },
        promise: {
          type: 'string',
        },
        recordStringBoolean: {
          type: 'object',
          additionalProperties: {
            type: 'boolean',
          },
        },
        recordUuidBoolean: {
          type: 'object',
          additionalProperties: {
            type: 'boolean',
          },
          propertyNames: {
            format: 'uuid',
          },
        },
        recordBooleanBoolean: {
          type: 'object',
          additionalProperties: {
            type: 'boolean',
          },
        },
        set: {
          type: 'array',
          uniqueItems: true,
          items: {
            type: 'string',
          },
        },
        string: {
          type: 'string',
        },
        stringMin: {
          type: 'string',
          minLength: 1,
        },
        stringMax: {
          type: 'string',
          maxLength: 1,
        },
        stringEmail: {
          type: 'string',
          format: 'email',
        },
        stringEmoji: {
          type: 'string',
          pattern: '^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$',
        },
        stringUrl: {
          type: 'string',
          format: 'uri',
        },
        stringUuid: {
          type: 'string',
          format: 'uuid',
        },
        stringRegEx: {
          type: 'string',
          pattern: 'abc',
        },
        stringCuid: {
          type: 'string',
          pattern: '^[cC][^\\s-]{8,}$',
        },
        tuple: {
          type: 'array',
          minItems: 3,
          maxItems: 3,
          items: [
            {
              type: 'string',
            },
            {
              type: 'number',
            },
            {
              type: 'boolean',
            },
          ],
        },
        undefined: {
          not: {},
        },
        unionPrimitives: {
          type: ['string', 'number', 'boolean', 'integer', 'null'],
        },
        unionPrimitiveLiterals: {
          type: ['number', 'string', 'null', 'boolean'],
          enum: [123, 'abc', null, true],
        },
        unionNonPrimitives: {
          anyOf: [
            {
              type: 'string',
            },
            {
              type: 'object',
              properties: {
                foo: {
                  type: 'string',
                },
                bar: {
                  type: 'number',
                },
              },
              required: ['foo'],
              additionalProperties: false,
            },
          ],
        },
        unknown: {},
      },
      additionalProperties: false,
      default: {
        string: 'hello',
      },
      description: 'watup',
    });
  });
});
