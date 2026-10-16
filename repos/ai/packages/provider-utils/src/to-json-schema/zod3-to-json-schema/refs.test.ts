import { describe, it, expect } from 'vitest';
import type { JSONSchema7 } from '@ai-sdk/provider';
import { z } from 'zod/v3';
import { zod3ToJsonSchema } from './zod3-to-json-schema';

describe('paths', () => {
  it('should handle recurring properties with paths', () => {
    const addressSchema = z.object({
      street: z.string(),
      number: z.number(),
      city: z.string(),
    });
    const someAddresses = z.object({
      address1: addressSchema,
      address2: addressSchema,
      lotsOfAddresses: z.array(addressSchema),
    });

    const parsedSchema = zod3ToJsonSchema(someAddresses);

    expect(parsedSchema).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        address1: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            number: { type: 'number' },
            city: { type: 'string' },
          },
          additionalProperties: false,
          required: ['street', 'number', 'city'],
        },
        address2: { $ref: '#/properties/address1' },
        lotsOfAddresses: {
          type: 'array',
          items: { $ref: '#/properties/address1' },
        },
      },
      additionalProperties: false,
      required: ['address1', 'address2', 'lotsOfAddresses'],
    } satisfies JSONSchema7);
  });

  it('Should properly reference union participants', () => {
    const participant = z.object({ str: z.string() });

    const schema = z.object({
      union: z.union([participant, z.string()]),
      part: participant,
    });

    const parsedSchema = zod3ToJsonSchema(schema);

    expect(parsedSchema).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        union: {
          anyOf: [
            {
              type: 'object',
              properties: {
                str: {
                  type: 'string',
                },
              },
              additionalProperties: false,
              required: ['str'],
            },
            {
              type: 'string',
            },
          ],
        },
        part: {
          $ref: '#/properties/union/anyOf/0',
        },
      },
      additionalProperties: false,
      required: ['union', 'part'],
    } satisfies JSONSchema7);
  });

  it('Should be able to handle recursive schemas', () => {
    type Category = {
      name: string;
      subcategories: Category[];
    };

    // cast to z.ZodSchema<Category>
    // @ts-ignore
    const categorySchema: z.ZodSchema<Category> = z.lazy(() =>
      z.object({
        name: z.string(),
        subcategories: z.array(categorySchema),
      }),
    );

    const parsedSchema = zod3ToJsonSchema(categorySchema);

    expect(parsedSchema).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        name: {
          type: 'string',
        },
        subcategories: {
          type: 'array',
          items: {
            $ref: '#',
          },
        },
      },
      required: ['name', 'subcategories'],
      additionalProperties: false,
    } satisfies JSONSchema7);
  });

  it('Should be able to handle complex & nested recursive schemas', () => {
    type Category = {
      name: string;
      inner: {
        subcategories?: Record<string, Category> | null;
      };
    };

    // cast to z.ZodSchema<Category>
    // @ts-ignore
    const categorySchema: z.ZodSchema<Category> = z.lazy(() =>
      z.object({
        name: z.string(),
        inner: z.object({
          subcategories: z.record(categorySchema).nullable().optional(),
        }),
      }),
    );

    const inObjectSchema = z.object({
      category: categorySchema,
    });

    const parsedSchema = zod3ToJsonSchema(inObjectSchema);

    expect(parsedSchema).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      additionalProperties: false,
      required: ['category'],
      properties: {
        category: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
            },
            inner: {
              type: 'object',
              additionalProperties: false,
              properties: {
                subcategories: {
                  anyOf: [
                    {
                      type: 'object',
                      additionalProperties: {
                        $ref: '#/properties/category',
                      },
                    },
                    {
                      type: 'null',
                    },
                  ],
                },
              },
            },
          },
          required: ['name', 'inner'],
          additionalProperties: false,
        },
      },
    } satisfies JSONSchema7);
  });

  it('should work with relative references', () => {
    const recurringSchema = z.string();
    const objectSchema = z.object({
      foo: recurringSchema,
      bar: recurringSchema,
    });

    const jsonSchema = zod3ToJsonSchema(objectSchema, {
      $refStrategy: 'relative',
    });

    expect(jsonSchema).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        foo: {
          type: 'string',
        },
        bar: {
          $ref: '1/foo',
        },
      },
      required: ['foo', 'bar'],
      additionalProperties: false,
    } satisfies JSONSchema7);
  });

  it('should be possible to override the base path', () => {
    const recurringSchema = z.string();
    const objectSchema = z.object({
      foo: recurringSchema,
      bar: recurringSchema,
    });

    const jsonSchema = zod3ToJsonSchema(objectSchema, {
      basePath: ['#', 'lol', 'xD'],
    });

    expect(jsonSchema).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        foo: {
          type: 'string',
        },
        bar: {
          $ref: '#/lol/xD/properties/foo',
        },
      },
      required: ['foo', 'bar'],
      additionalProperties: false,
    } satisfies JSONSchema7);
  });

  it('should be possible to override the base path with name', () => {
    const recurringSchema = z.string();
    const objectSchema = z.object({
      foo: recurringSchema,
      bar: recurringSchema,
    });

    const jsonSchema = zod3ToJsonSchema(objectSchema, {
      basePath: ['#', 'lol', 'xD'],
      name: 'kex',
    });

    expect(jsonSchema).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      $ref: '#/lol/xD/definitions/kex',
      definitions: {
        kex: {
          type: 'object',
          properties: {
            foo: {
              type: 'string',
            },
            bar: {
              $ref: '#/lol/xD/definitions/kex/properties/foo',
            },
          },
          required: ['foo', 'bar'],
          additionalProperties: false,
        },
      },
    } satisfies JSONSchema7);
  });

  it('should be possible to opt out of $ref building', () => {
    const recurringSchema = z.string();
    const objectSchema = z.object({
      foo: recurringSchema,
      bar: recurringSchema,
    });

    const jsonSchema = zod3ToJsonSchema(objectSchema, {
      $refStrategy: 'none',
    });

    expect(jsonSchema).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        foo: {
          type: 'string',
        },
        bar: {
          type: 'string',
        },
      },
      required: ['foo', 'bar'],
      additionalProperties: false,
    } satisfies JSONSchema7);
  });

  it('When opting out of ref building and using recursive schemas, should warn and default to any', () => {
    const was = console.warn;
    let warning = '';
    console.warn = (x: any) => (warning = x);

    type Category = {
      name: string;
      subcategories: Category[];
    };

    // cast to z.ZodSchema<Category>
    // @ts-ignore
    const categorySchema: z.ZodSchema<Category> = z.lazy(() =>
      z.object({
        name: z.string(),
        subcategories: z.array(categorySchema),
      }),
    );

    const parsedSchema = zod3ToJsonSchema(categorySchema, {
      $refStrategy: 'none',
    });

    expect(parsedSchema).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        name: {
          type: 'string',
        },
        subcategories: {
          type: 'array',
          items: {},
        },
      },
      required: ['name', 'subcategories'],
      additionalProperties: false,
    } satisfies JSONSchema7);

    expect(warning).toBe(
      'Recursive reference detected at #/properties/subcategories/items! Defaulting to any',
    );

    console.warn = was;
  });

  it('should be possible to override get proper references even when picking optional definitions path $defs', () => {
    const recurringSchema = z.string();
    const objectSchema = z.object({
      foo: recurringSchema,
      bar: recurringSchema,
    });

    const jsonSchema = zod3ToJsonSchema(objectSchema, {
      name: 'hello',
      definitionPath: '$defs',
    });

    expect(jsonSchema).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      $ref: '#/$defs/hello',
      $defs: {
        hello: {
          type: 'object',
          properties: {
            foo: {
              type: 'string',
            },
            bar: {
              $ref: '#/$defs/hello/properties/foo',
            },
          },
          required: ['foo', 'bar'],
          additionalProperties: false,
        },
      },
    } satisfies JSONSchema7);
  });

  it('should be possible to override get proper references even when picking optional definitions path definitions', () => {
    const recurringSchema = z.string();
    const objectSchema = z.object({
      foo: recurringSchema,
      bar: recurringSchema,
    });

    const jsonSchema = zod3ToJsonSchema(objectSchema, {
      name: 'hello',
      definitionPath: 'definitions',
    });

    expect(jsonSchema).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      $ref: '#/definitions/hello',
      definitions: {
        hello: {
          type: 'object',
          properties: {
            foo: {
              type: 'string',
            },
            bar: {
              $ref: '#/definitions/hello/properties/foo',
            },
          },
          required: ['foo', 'bar'],
          additionalProperties: false,
        },
      },
    } satisfies JSONSchema7);
  });

  it('should preserve correct $ref when overriding name with string', () => {
    const recurringSchema = z.string();
    const objectSchema = z.object({
      foo: recurringSchema,
      bar: recurringSchema,
    });

    const jsonSchema = zod3ToJsonSchema(objectSchema, 'hello');

    expect(jsonSchema).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      $ref: '#/definitions/hello',
      definitions: {
        hello: {
          type: 'object',
          properties: {
            foo: {
              type: 'string',
            },
            bar: {
              $ref: '#/definitions/hello/properties/foo',
            },
          },
          required: ['foo', 'bar'],
          additionalProperties: false,
        },
      },
    } satisfies JSONSchema7);
  });

  it('should preserve correct $ref when overriding name with object property', () => {
    const recurringSchema = z.string();
    const objectSchema = z.object({
      foo: recurringSchema,
      bar: recurringSchema,
    });

    const jsonSchema = zod3ToJsonSchema(objectSchema, { name: 'hello' });

    expect(jsonSchema).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      $ref: '#/definitions/hello',
      definitions: {
        hello: {
          type: 'object',
          properties: {
            foo: {
              type: 'string',
            },
            bar: {
              $ref: '#/definitions/hello/properties/foo',
            },
          },
          required: ['foo', 'bar'],
          additionalProperties: false,
        },
      },
    } satisfies JSONSchema7);
  });

  it('should be possible to preload a single definition', () => {
    const myRecurringSchema = z.string();
    const myObjectSchema = z.object({
      a: myRecurringSchema,
      b: myRecurringSchema,
    });

    const myJsonSchema = zod3ToJsonSchema(myObjectSchema, {
      definitions: { myRecurringSchema },
    });

    expect(myJsonSchema).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      required: ['a', 'b'],
      properties: {
        a: {
          $ref: '#/definitions/myRecurringSchema',
        },
        b: {
          $ref: '#/definitions/myRecurringSchema',
        },
      },
      additionalProperties: false,
      definitions: {
        myRecurringSchema: {
          type: 'string',
        },
      },
    } satisfies JSONSchema7);
  });

  it('should be possible to preload multiple definitions', () => {
    const myRecurringSchema = z.string();
    const mySecondRecurringSchema = z.object({
      x: myRecurringSchema,
    });
    const myObjectSchema = z.object({
      a: myRecurringSchema,
      b: mySecondRecurringSchema,
      c: mySecondRecurringSchema,
    });

    const myJsonSchema = zod3ToJsonSchema(myObjectSchema, {
      definitions: { myRecurringSchema, mySecondRecurringSchema },
    });

    expect(myJsonSchema).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      required: ['a', 'b', 'c'],
      properties: {
        a: {
          $ref: '#/definitions/myRecurringSchema',
        },
        b: {
          $ref: '#/definitions/mySecondRecurringSchema',
        },
        c: {
          $ref: '#/definitions/mySecondRecurringSchema',
        },
      },
      additionalProperties: false,
      definitions: {
        myRecurringSchema: {
          type: 'string',
        },
        mySecondRecurringSchema: {
          type: 'object',
          required: ['x'],
          properties: {
            x: {
              $ref: '#/definitions/myRecurringSchema',
            },
          },
          additionalProperties: false,
        },
      },
    } satisfies JSONSchema7);
  });

  it('should be possible to preload multiple definitions and have a named schema', () => {
    const myRecurringSchema = z.string();
    const mySecondRecurringSchema = z.object({
      x: myRecurringSchema,
    });
    const myObjectSchema = z.object({
      a: myRecurringSchema,
      b: mySecondRecurringSchema,
      c: mySecondRecurringSchema,
    });

    const myJsonSchema = zod3ToJsonSchema(myObjectSchema, {
      definitions: { myRecurringSchema, mySecondRecurringSchema },
      name: 'mySchemaName',
    });

    expect(myJsonSchema).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      $ref: '#/definitions/mySchemaName',
      definitions: {
        mySchemaName: {
          type: 'object',
          required: ['a', 'b', 'c'],
          properties: {
            a: {
              $ref: '#/definitions/myRecurringSchema',
            },
            b: {
              $ref: '#/definitions/mySecondRecurringSchema',
            },
            c: {
              $ref: '#/definitions/mySecondRecurringSchema',
            },
          },
          additionalProperties: false,
        },
        myRecurringSchema: {
          type: 'string',
        },
        mySecondRecurringSchema: {
          type: 'object',
          required: ['x'],
          properties: {
            x: {
              $ref: '#/definitions/myRecurringSchema',
            },
          },
          additionalProperties: false,
        },
      },
    } satisfies JSONSchema7);
  });

  it('should be possible to preload multiple definitions and have a named schema and set the definitions path', () => {
    const myRecurringSchema = z.string();
    const mySecondRecurringSchema = z.object({
      x: myRecurringSchema,
    });
    const myObjectSchema = z.object({
      a: myRecurringSchema,
      b: mySecondRecurringSchema,
      c: mySecondRecurringSchema,
    });

    const myJsonSchema = zod3ToJsonSchema(myObjectSchema, {
      definitions: { myRecurringSchema, mySecondRecurringSchema },
      name: 'mySchemaName',
      definitionPath: '$defs',
    });

    expect(myJsonSchema).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      $ref: '#/$defs/mySchemaName',
      $defs: {
        mySchemaName: {
          type: 'object',
          required: ['a', 'b', 'c'],
          properties: {
            a: {
              $ref: '#/$defs/myRecurringSchema',
            },
            b: {
              $ref: '#/$defs/mySecondRecurringSchema',
            },
            c: {
              $ref: '#/$defs/mySecondRecurringSchema',
            },
          },
          additionalProperties: false,
        },
        myRecurringSchema: {
          type: 'string',
        },
        mySecondRecurringSchema: {
          type: 'object',
          required: ['x'],
          properties: {
            x: {
              $ref: '#/$defs/myRecurringSchema',
            },
          },
          additionalProperties: false,
        },
      },
    } satisfies JSONSchema7);
  });

  it('should be possible to preload a single definition with custom basePath', () => {
    const myRecurringSchema = z.string();
    const myObjectSchema = z.object({
      a: myRecurringSchema,
      b: myRecurringSchema,
    });

    const myJsonSchema = zod3ToJsonSchema(myObjectSchema, {
      definitions: { myRecurringSchema },
      basePath: ['hello'],
    });

    expect(myJsonSchema).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      required: ['a', 'b'],
      properties: {
        a: {
          $ref: 'hello/definitions/myRecurringSchema',
        },
        b: {
          $ref: 'hello/definitions/myRecurringSchema',
        },
      },
      additionalProperties: false,
      definitions: {
        myRecurringSchema: {
          type: 'string',
        },
      },
    } satisfies JSONSchema7);
  });

  it('should be possible to preload a single definition with custom basePath and name', () => {
    const myRecurringSchema = z.string();
    const myObjectSchema = z.object({
      a: myRecurringSchema,
      b: myRecurringSchema,
    });

    const myJsonSchema = zod3ToJsonSchema(myObjectSchema, {
      definitions: { myRecurringSchema },
      basePath: ['hello'],
      name: 'kex',
    });

    expect(myJsonSchema).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      $ref: 'hello/definitions/kex',
      definitions: {
        kex: {
          type: 'object',
          required: ['a', 'b'],
          properties: {
            a: {
              $ref: 'hello/definitions/myRecurringSchema',
            },
            b: {
              $ref: 'hello/definitions/myRecurringSchema',
            },
          },
          additionalProperties: false,
        },
        myRecurringSchema: {
          type: 'string',
        },
      },
    } satisfies JSONSchema7);
  });

  it('should be possible for a preloaded definition to circularly reference itself', () => {
    const myRecurringSchema: any = z.object({
      circular: z.lazy(() => myRecurringSchema),
    });

    const myObjectSchema = z.object({
      a: myRecurringSchema,
      b: myRecurringSchema,
    });

    const myJsonSchema = zod3ToJsonSchema(myObjectSchema, {
      definitions: { myRecurringSchema },
      basePath: ['hello'],
      name: 'kex',
    });

    expect(myJsonSchema).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      $ref: 'hello/definitions/kex',
      definitions: {
        kex: {
          type: 'object',
          required: ['a', 'b'],
          properties: {
            a: {
              $ref: 'hello/definitions/myRecurringSchema',
            },
            b: {
              $ref: 'hello/definitions/myRecurringSchema',
            },
          },
          additionalProperties: false,
        },
        myRecurringSchema: {
          type: 'object',
          required: ['circular'],
          properties: {
            circular: {
              $ref: 'hello/definitions/myRecurringSchema',
            },
          },
          additionalProperties: false,
        },
      },
    } satisfies JSONSchema7);
  });

  it('should handle the user example', () => {
    interface User {
      id: string;
      headUser?: User;
    }

    const userSchema: z.ZodType<User> = z.lazy(() =>
      z.object({
        id: z.string(),
        headUser: userSchema.optional(),
      }),
    );

    const schema = z.object({ user: userSchema });

    expect(
      zod3ToJsonSchema(schema, {
        definitions: { userSchema },
      }),
    ).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        user: {
          $ref: '#/definitions/userSchema',
        },
      },
      required: ['user'],
      additionalProperties: false,
      definitions: {
        userSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
            },
            headUser: {
              $ref: '#/definitions/userSchema',
            },
          },
          required: ['id'],
          additionalProperties: false,
        },
      },
    } satisfies JSONSchema7);
  });

  it('should handle mutual recursion', () => {
    const leafSchema = z.object({
      prop: z.string(),
    });

    let nodeChildSchema: z.ZodType;

    const nodeSchema = z.object({
      children: z.lazy(() => z.array(nodeChildSchema)),
    });

    nodeChildSchema = z.union([leafSchema, nodeSchema]);

    const treeSchema = z.object({
      nodes: nodeSchema,
    });

    expect(
      zod3ToJsonSchema(treeSchema, {
        name: 'Tree',
        definitions: {
          Leaf: leafSchema,
          NodeChild: nodeChildSchema,
          Node: nodeSchema,
        },
      }),
    ).toStrictEqual({
      $ref: '#/definitions/Tree',
      definitions: {
        Leaf: {
          type: 'object',
          properties: {
            prop: {
              type: 'string',
            },
          },
          required: ['prop'],
          additionalProperties: false,
        },
        Node: {
          type: 'object',
          properties: {
            children: {
              type: 'array',
              items: {
                $ref: '#/definitions/NodeChild',
              },
            },
          },
          required: ['children'],
          additionalProperties: false,
        },
        NodeChild: {
          anyOf: [
            {
              $ref: '#/definitions/Leaf',
            },
            {
              $ref: '#/definitions/Node',
            },
          ],
        },
        Tree: {
          type: 'object',
          properties: {
            nodes: {
              $ref: '#/definitions/Node',
            },
          },
          required: ['nodes'],
          additionalProperties: false,
        },
      },
      $schema: 'http://json-schema.org/draft-07/schema#',
    } satisfies JSONSchema7);
  });

  it('should not fail when definition is lazy', () => {
    const lazyString = z.lazy(() => z.string());

    const lazyObject = z.lazy(() => z.object({ lazyProp: lazyString }));

    const jsonSchema = zod3ToJsonSchema(lazyObject, {
      definitions: { lazyString },
    });

    expect(jsonSchema).toStrictEqual({
      type: 'object',
      properties: { lazyProp: { $ref: '#/definitions/lazyString' } },
      required: ['lazyProp'],
      additionalProperties: false,
      definitions: { lazyString: { type: 'string' } },
      $schema: 'http://json-schema.org/draft-07/schema#',
    } satisfies JSONSchema7);
  });
});
