import { describe, expect, it } from 'vitest';
import * as z4 from 'zod/v4';
import { safeParseJSON } from './parse-json';
import { asSchema, zodSchema, type StandardSchema } from './schema';

describe('asSchema', () => {
  it('should create an object schema when no schema is provided', async () => {
    const schema = asSchema(undefined);

    expect(await schema.jsonSchema).toStrictEqual({
      type: 'object',
      properties: {},
      additionalProperties: false,
    });
  });
});

describe('zodSchema', () => {
  describe('zod/v4', () => {
    describe('json schema conversion', () => {
      it('should create a schema with simple types', () => {
        const schema = zodSchema(
          z4.object({
            text: z4.string(),
            number: z4.number(),
          }),
        );

        expect(schema.jsonSchema).toMatchSnapshot();
      });

      it('should support optional fields in object', () => {
        const schema = zodSchema(
          z4.object({
            required: z4.string(),
            optional: z4.string().optional(),
          }),
        );

        expect(schema.jsonSchema).toMatchSnapshot();
      });

      it('should support optional fields with descriptions in object', () => {
        const schema = zodSchema(
          z4.object({
            required: z4.string().describe('Required description'),
            optional: z4.string().optional().describe('Optional description'),
          }),
        );

        expect(schema.jsonSchema).toMatchSnapshot();
      });

      it('should support arrays', () => {
        const schema = zodSchema(
          z4.object({
            items: z4.array(z4.string()),
          }),
        );

        expect(schema.jsonSchema).toMatchSnapshot();
      });

      it('should support optional arrays', () => {
        const schema = zodSchema(
          z4.object({
            items: z4.array(z4.string()).optional(),
          }),
        );

        expect(schema.jsonSchema).toMatchSnapshot();
      });

      it('should support required enums', () => {
        const schema = zodSchema(
          z4.object({
            type: z4.enum(['a', 'b', 'c']),
          }),
        );

        expect(schema.jsonSchema).toMatchSnapshot();
      });

      it('should support optional enums', () => {
        const schema = zodSchema(
          z4.object({
            type: z4.enum(['a', 'b', 'c']).optional(),
          }),
        );

        expect(schema.jsonSchema).toMatchSnapshot();
      });

      it('should duplicate referenced schemas (and not use references) by default', () => {
        const Inner = z4.object({
          text: z4.string(),
          number: z4.number(),
        });

        const schema = zodSchema(
          z4.object({
            group1: z4.array(Inner),
            group2: z4.array(Inner),
          }),
        );

        expect(schema.jsonSchema).toMatchSnapshot();
      });

      it('should use references when useReferences is true', () => {
        const Inner = z4.object({
          text: z4.string(),
          number: z4.number(),
        });

        const schema = zodSchema(
          z4.object({
            group1: z4.array(Inner),
            group2: z4.array(Inner),
          }),
          { useReferences: true },
        );

        expect(schema.jsonSchema).toMatchSnapshot();
      });

      it('should use recursive references with z.lazy when useReferences is true', () => {
        const baseCategorySchema = z4.object({
          name: z4.string(),
        });

        type Category = z4.infer<typeof baseCategorySchema> & {
          subcategories: Category[];
        };

        const categorySchema: z4.ZodType<Category> = baseCategorySchema.extend({
          subcategories: z4.lazy(() => categorySchema.array()),
        });

        const schema = zodSchema(
          z4.object({
            category: categorySchema,
          }),
          { useReferences: true },
        );

        expect(schema.jsonSchema).toMatchSnapshot();
      });

      it('should support nullable', () => {
        const schema = zodSchema(
          z4.object({
            location: z4.string().nullable(),
          }),
        );

        expect(schema.jsonSchema).toMatchSnapshot();
      });

      it('.literal and .enum', () => {
        const schema = zodSchema(
          z4.object({
            text: z4.literal('hello'),
            number: z4.enum(['one', 'two', 'three']),
          }),
        );

        expect(schema.jsonSchema).toMatchSnapshot();
      });

      it('should generate JSON schema for input when transform is used', async () => {
        const schema = zodSchema(
          z4.object({
            user: z4.object({
              id: z4
                .string()
                .transform(val => parseInt(val, 10))
                .pipe(z4.number()),
              name: z4.string(),
            }),
          }),
        );

        expect(schema.jsonSchema).toMatchSnapshot();
      });
    });

    describe('output validation', () => {
      it('should validate output with transform', async () => {
        const schema = zodSchema(
          z4.object({
            user: z4.object({
              id: z4
                .string()
                .transform(val => parseInt(val, 10))
                .pipe(z4.number()),
              name: z4.string(),
            }),
          }),
        );

        const result = await safeParseJSON({
          text: '{"user": {"id": "123", "name": "John"}}',
          schema,
        });

        expect(result).toStrictEqual({
          success: true,
          value: { user: { id: 123, name: 'John' } },
          rawValue: { user: { id: '123', name: 'John' } },
        });
      });
    });
  });
});

describe('StandardSchema (StandardJSONSchemaV1)', () => {
  // Helper to create a StandardSchema mock
  function createStandardSchema<T>(options: {
    jsonSchema: object;
    validate: (value: unknown) => Promise<{ value: T } | { issues: Error[] }>;
  }): StandardSchema<T> {
    return {
      '~standard': {
        version: 1,
        vendor: 'custom',
        validate: options.validate,
        jsonSchema: {
          input: () => options.jsonSchema,
          output: () => options.jsonSchema,
        },
      },
    } as StandardSchema<T>;
  }

  describe('json schema conversion', () => {
    it('should return the JSON schema from input()', async () => {
      const standardSchema = createStandardSchema<{
        name: string;
        age: number;
      }>({
        jsonSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
          required: ['name', 'age'],
        },
        validate: async value => ({
          value: value as { name: string; age: number },
        }),
      });

      const schema = asSchema(standardSchema);

      expect(await schema.jsonSchema).toStrictEqual({
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      });
    });

    it('should pass target draft-07 to jsonSchema.input()', async () => {
      let capturedTarget: string | undefined;

      const standardSchema: StandardSchema<{ text: string }> = {
        '~standard': {
          version: 1,
          vendor: 'custom',
          validate: async value => ({ value: value as { text: string } }),
          jsonSchema: {
            input: (options: { target?: string } = {}) => {
              capturedTarget = options.target;
              return {
                type: 'object',
                properties: { text: { type: 'string' } },
              };
            },
            output: () => ({
              type: 'object',
              properties: { text: { type: 'string' } },
            }),
          },
        },
      } as StandardSchema<{ text: string }>;

      const schema = asSchema(standardSchema);
      const jsonSchema = await schema.jsonSchema;

      expect(capturedTarget).toBe('draft-07');
      expect(jsonSchema).toStrictEqual({
        type: 'object',
        additionalProperties: false,
        properties: { text: { type: 'string' } },
      });
    });

    it('should support nested objects', async () => {
      const standardSchema = createStandardSchema<{
        user: { name: string; email: string };
      }>({
        jsonSchema: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                email: { type: 'string' },
              },
              required: ['name', 'email'],
            },
          },
          required: ['user'],
        },
        validate: async value => ({
          value: value as { user: { name: string; email: string } },
        }),
      });

      const schema = asSchema(standardSchema);

      expect(await schema.jsonSchema).toStrictEqual({
        type: 'object',
        additionalProperties: false,
        properties: {
          user: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
            },
            required: ['name', 'email'],
          },
        },
        required: ['user'],
      });
    });

    it('should support arrays', async () => {
      const standardSchema = createStandardSchema<{ items: string[] }>({
        jsonSchema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['items'],
        },
        validate: async value => ({ value: value as { items: string[] } }),
      });

      const schema = asSchema(standardSchema);

      expect(await schema.jsonSchema).toStrictEqual({
        type: 'object',
        additionalProperties: false,
        properties: {
          items: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['items'],
      });
    });
  });

  describe('output validation', () => {
    it('should validate and return value for valid input', async () => {
      const standardSchema = createStandardSchema<{
        name: string;
        age: number;
      }>({
        jsonSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
        },
        validate: async value => {
          const obj = value as any;
          if (
            typeof obj === 'object' &&
            obj !== null &&
            typeof obj.name === 'string' &&
            typeof obj.age === 'number'
          ) {
            return { value: obj };
          }
          return { issues: [new Error('Invalid input')] };
        },
      });

      const schema = asSchema(standardSchema);
      const result = await schema.validate!({ name: 'John', age: 30 });

      expect(result).toStrictEqual({
        success: true,
        value: { name: 'John', age: 30 },
      });
    });

    it('should return error for invalid input', async () => {
      const standardSchema = createStandardSchema<{
        name: string;
        age: number;
      }>({
        jsonSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
        },
        validate: async value => {
          const obj = value as any;
          if (
            typeof obj === 'object' &&
            obj !== null &&
            typeof obj.name === 'string' &&
            typeof obj.age === 'number'
          ) {
            return { value: obj };
          }
          return { issues: [new Error('Invalid input')] };
        },
      });

      const schema = asSchema(standardSchema);
      const result = await schema.validate!({
        name: 'John',
        age: 'not a number',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toContain('Type validation failed');
      }
    });

    it('should support transform in validation', async () => {
      const standardSchema = createStandardSchema<{ id: number; name: string }>(
        {
          jsonSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' }, // Input is string
              name: { type: 'string' },
            },
          },
          validate: async value => {
            const obj = value as any;
            // Transform string id to number
            return {
              value: {
                id: parseInt(obj.id, 10),
                name: obj.name,
              },
            };
          },
        },
      );

      const schema = asSchema(standardSchema);
      const result = await schema.validate!({ id: '123', name: 'John' });

      expect(result).toStrictEqual({
        success: true,
        value: { id: 123, name: 'John' },
      });
    });
  });

  describe('asSchema detection', () => {
    it('should detect non-zod standard schema by vendor', async () => {
      const standardSchema: StandardSchema<{ text: string }> = {
        '~standard': {
          version: 1,
          vendor: 'valibot', // non-zod vendor
          validate: async value => ({ value: value as { text: string } }),
          jsonSchema: {
            input: () => ({
              type: 'object',
              properties: { text: { type: 'string' } },
            }),
            output: () => ({
              type: 'object',
              properties: { text: { type: 'string' } },
            }),
          },
        },
      } as StandardSchema<{ text: string }>;

      const schema = asSchema(standardSchema);

      expect(await schema.jsonSchema).toStrictEqual({
        type: 'object',
        additionalProperties: false,
        properties: { text: { type: 'string' } },
      });
    });
  });
});
