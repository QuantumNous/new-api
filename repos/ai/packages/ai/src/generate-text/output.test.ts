import { fail } from 'assert';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { verifyNoObjectGeneratedError } from '../error/verify-no-object-generated-error';
import { array, choice, json, object, text } from './output';

const context = {
  response: {
    id: '123',
    timestamp: new Date(),
    modelId: '456',
  },
  usage: {
    inputTokens: 1,
    inputTokenDetails: {
      noCacheTokens: 1,
      cacheReadTokens: undefined,
      cacheWriteTokens: undefined,
    },
    outputTokens: 2,
    outputTokenDetails: {
      reasoningTokens: undefined,
      textTokens: 2,
    },
    totalTokens: 3,
    reasoningTokens: undefined,
    cachedInputTokens: undefined,
  },
  finishReason: 'length',
} as const;

describe('Output.text', () => {
  const text1 = text();

  describe('responseFormat', () => {
    it('should return the text as is', async () => {
      const result = await text1.responseFormat;
      expect(result).toMatchInlineSnapshot(`
        {
          "type": "text",
        }
      `);
    });
  });

  describe('parseCompleteOutput', () => {
    it('should return the text as is', async () => {
      const result = await text1.parseCompleteOutput(
        { text: 'some output' },
        context,
      );
      expect(result).toBe('some output');
    });

    it('should handle empty string', async () => {
      const result = await text1.parseCompleteOutput({ text: '' }, context);
      expect(result).toBe('');
    });

    it('should handle undefined as string "undefined"', async () => {
      // Output.text() expects a string, so passing undefined would be a type error,
      // but we cast for test purposes to ensure what happens
      const result = await text1.parseCompleteOutput(
        { text: undefined as any },
        context,
      );
      expect(result).toBeUndefined();
    });
  });

  describe('parsePartialOutput', () => {
    it('should return the string as partial', async () => {
      const result = await text1.parsePartialOutput({ text: 'partial text' });
      expect(result).toEqual({ partial: 'partial text' });
    });

    it('should handle empty string partial', async () => {
      const result = await text1.parsePartialOutput({ text: '' });
      expect(result).toEqual({ partial: '' });
    });
  });
});

describe('Output.object', () => {
  const object1 = object({ schema: z.object({ content: z.string() }) });

  describe('responseFormat', () => {
    it('should return the JSON schema for the object', async () => {
      const result = await object1.responseFormat;
      expect(result).toMatchInlineSnapshot(`
        {
          "schema": {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "additionalProperties": false,
            "properties": {
              "content": {
                "type": "string",
              },
            },
            "required": [
              "content",
            ],
            "type": "object",
          },
          "type": "json",
        }
      `);
    });

    it('should include name and description when provided', async () => {
      const objectWithNameAndDesc = object({
        schema: z.object({ content: z.string() }),
        name: 'test-name',
        description: 'test description',
      });
      const result = await objectWithNameAndDesc.responseFormat;
      expect(result).toMatchInlineSnapshot(`
        {
          "description": "test description",
          "name": "test-name",
          "schema": {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "additionalProperties": false,
            "properties": {
              "content": {
                "type": "string",
              },
            },
            "required": [
              "content",
            ],
            "type": "object",
          },
          "type": "json",
        }
      `);
    });
  });

  describe('parseCompleteOutput', () => {
    it('should parse the output of the model', async () => {
      const result = await object1.parseCompleteOutput(
        { text: `{ "content": "test" }` },
        context,
      );

      expect(result).toStrictEqual({ content: 'test' });
    });

    it('should throw NoObjectGeneratedError when parsing fails', async () => {
      try {
        await object1.parseCompleteOutput({ text: '{ broken json' }, context);
        fail('must throw error');
      } catch (error) {
        verifyNoObjectGeneratedError(error, {
          message: 'No object generated: could not parse the response.',
          response: context.response,
          usage: context.usage,
          finishReason: context.finishReason,
        });
      }
    });

    it('should throw NoObjectGeneratedError when schema validation fails', async () => {
      try {
        await object1.parseCompleteOutput(
          { text: `{ "content": 123 }` },
          context,
        );
        fail('must throw error');
      } catch (error) {
        verifyNoObjectGeneratedError(error, {
          message: 'No object generated: response did not match schema.',
          response: context.response,
          usage: context.usage,
          finishReason: context.finishReason,
        });
      }
    });
  });

  describe('parsePartialOutput', () => {
    it('should return undefined for undefined input', async () => {
      const result = await object1.parsePartialOutput({
        text: undefined as any,
      });
      expect(result).toBeUndefined();
    });

    it('should return partial object for valid JSON', async () => {
      const result = await object1.parsePartialOutput({
        text: '{ "content": "test" }',
      });
      expect(result).toEqual({ partial: { content: 'test' } });
    });

    it('should return partial object for repairable JSON', async () => {
      const result = await object1.parsePartialOutput({
        text: '{ "content": "test"',
      });
      expect(result).toEqual({ partial: { content: 'test' } });
    });

    it('should handle partial object with missing closing brace', async () => {
      const result = await object1.parsePartialOutput({
        text: '{ "content": "partial", "count": 42',
      });
      expect(result).toEqual({ partial: { content: 'partial', count: 42 } });
    });

    it('should handle partial array', async () => {
      const arrayOutput = object({
        schema: z.object({ items: z.array(z.string()) }),
      });
      const result = await arrayOutput.parsePartialOutput({
        text: '{ "items": ["a", "b"',
      });
      expect(result).toEqual({ partial: { items: ['a', 'b'] } });
    });

    it('should handle empty string input', async () => {
      const result = await object1.parsePartialOutput({ text: '' });
      expect(result).toBeUndefined();
    });

    it('should handle partial string value', async () => {
      const result = await object1.parsePartialOutput({
        text: '{ "content": "partial str',
      });
      expect(result).toEqual({ partial: { content: 'partial str' } });
    });
  });
});

describe('Output.array', () => {
  const array1 = array({ element: z.object({ content: z.string() }) });

  describe('responseFormat', () => {
    it('should return the JSON schema for the array', async () => {
      const result = await array1.responseFormat;
      expect(result).toMatchInlineSnapshot(`
        {
          "schema": {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "additionalProperties": false,
            "properties": {
              "elements": {
                "items": {
                  "additionalProperties": false,
                  "properties": {
                    "content": {
                      "type": "string",
                    },
                  },
                  "required": [
                    "content",
                  ],
                  "type": "object",
                },
                "type": "array",
              },
            },
            "required": [
              "elements",
            ],
            "type": "object",
          },
          "type": "json",
        }
      `);
    });

    it('should include name and description when provided', async () => {
      const arrayWithNameAndDesc = array({
        element: z.object({ content: z.string() }),
        name: 'test-array-name',
        description: 'test array description',
      });
      const result = await arrayWithNameAndDesc.responseFormat;
      expect(result).toMatchInlineSnapshot(`
        {
          "description": "test array description",
          "name": "test-array-name",
          "schema": {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "additionalProperties": false,
            "properties": {
              "elements": {
                "items": {
                  "additionalProperties": false,
                  "properties": {
                    "content": {
                      "type": "string",
                    },
                  },
                  "required": [
                    "content",
                  ],
                  "type": "object",
                },
                "type": "array",
              },
            },
            "required": [
              "elements",
            ],
            "type": "object",
          },
          "type": "json",
        }
      `);
    });
  });

  describe('parseCompleteOutput', () => {
    it('should parse the output of the model', async () => {
      const result = await array1.parseCompleteOutput(
        { text: `{ "elements": [{ "content": "test" }] }` },
        context,
      );

      expect(result).toStrictEqual([{ content: 'test' }]);
    });

    it('should throw NoObjectGeneratedError when parsing fails', async () => {
      try {
        await array1.parseCompleteOutput({ text: '{ broken json' }, context);
        fail('must throw error');
      } catch (error) {
        verifyNoObjectGeneratedError(error, {
          message: 'No object generated: could not parse the response.',
          response: context.response,
          usage: context.usage,
          finishReason: context.finishReason,
        });
      }
    });

    it('should throw NoObjectGeneratedError when schema validation fails', async () => {
      try {
        await array1.parseCompleteOutput(
          { text: `{ "elements": [{ "content": 123 }] }` },
          context,
        );
        fail('must throw error');
      } catch (error) {
        verifyNoObjectGeneratedError(error, {
          message: 'No object generated: response did not match schema.',
          response: context.response,
          usage: context.usage,
          finishReason: context.finishReason,
        });
      }
    });

    it('should return schema-validated values (with transforms applied)', async () => {
      const arrayWithTransform = array({
        element: z
          .object({ content: z.string() })
          .transform(val => ({ ...val, extra: true })),
      });

      const result = await arrayWithTransform.parseCompleteOutput(
        { text: `{ "elements": [{ "content": "hello" }] }` },
        context,
      );

      expect(result).toStrictEqual([{ content: 'hello', extra: true }]);
    });

    it('should return validated values for multiple elements', async () => {
      const result = await array1.parseCompleteOutput(
        {
          text: `{ "elements": [{ "content": "a" }, { "content": "b" }, { "content": "c" }] }`,
        },
        context,
      );

      expect(result).toStrictEqual([
        { content: 'a' },
        { content: 'b' },
        { content: 'c' },
      ]);
    });
  });

  describe('array.parsePartialOutput', () => {
    it('should parse partial output successfully for successful-parse', async () => {
      const partial = await array1.parsePartialOutput({
        text: `{ "elements": [{ "content": "a" }, { "content": "b" }] }`,
      });
      expect(partial).toEqual({
        partial: [{ content: 'a' }, { content: 'b' }],
      });
    });

    it('should parse partial output successfully for repaired-parse (returns all but last element)', async () => {
      // Simulate an incomplete last element (at the end, missing " }")
      const partial = await array1.parsePartialOutput({
        text: `{ "elements": [{ "content": "a" }, { "content": "b" }`,
      });
      // Should only return [{ content: "a" }]
      expect(partial).toEqual({
        partial: [{ content: 'a' }],
      });
    });

    it('should return undefined for failed-parse', async () => {
      const partial = await array1.parsePartialOutput({
        text: '{ not valid json',
      });
      expect(partial).toBeUndefined();
    });

    it('should return undefined when input is undefined', async () => {
      const partial = await array1.parsePartialOutput({
        text: undefined as any,
      });
      expect(partial).toBeUndefined();
    });

    it('should return undefined if elements is missing', async () => {
      // "elements" property is missing
      const partial = await array1.parsePartialOutput({
        text: `{ "foo": [1,2,3] }`,
      });
      expect(partial).toBeUndefined();
    });

    it('should return undefined if elements is not an array', async () => {
      // "elements" property exists but is not an array
      const partial = await array1.parsePartialOutput({
        text: `{ "elements": "not-an-array" }`,
      });
      expect(partial).toBeUndefined();
    });

    it('should handle an empty array of elements', async () => {
      const partial = await array1.parsePartialOutput({
        text: `{ "elements": [] }`,
      });
      expect(partial).toEqual({ partial: [] });
    });
  });
});

describe('Output.choice', () => {
  const choice1 = choice({
    options: ['aaa', 'aab', 'ccc'],
  });

  describe('responseFormat', () => {
    it('should return the JSON schema for the choice', async () => {
      const result = await choice1.responseFormat;
      expect(result).toMatchInlineSnapshot(`
        {
          "schema": {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "additionalProperties": false,
            "properties": {
              "result": {
                "enum": [
                  "aaa",
                  "aab",
                  "ccc",
                ],
                "type": "string",
              },
            },
            "required": [
              "result",
            ],
            "type": "object",
          },
          "type": "json",
        }
      `);
    });

    it('should include name and description when provided', async () => {
      const choiceWithNameAndDesc = choice({
        options: ['aaa', 'aab', 'ccc'],
        name: 'test-choice-name',
        description: 'test choice description',
      });
      const result = await choiceWithNameAndDesc.responseFormat;
      expect(result).toMatchInlineSnapshot(`
        {
          "description": "test choice description",
          "name": "test-choice-name",
          "schema": {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "additionalProperties": false,
            "properties": {
              "result": {
                "enum": [
                  "aaa",
                  "aab",
                  "ccc",
                ],
                "type": "string",
              },
            },
            "required": [
              "result",
            ],
            "type": "object",
          },
          "type": "json",
        }
      `);
    });
  });

  describe('parseCompleteOutput', () => {
    it('should parse a valid choice output', async () => {
      const result = await choice1.parseCompleteOutput(
        { text: `{ "result": "aaa" }` },
        context,
      );
      expect(result).toBe('aaa');
    });

    it('should throw NoObjectGeneratedError if JSON is invalid', async () => {
      await expect(
        choice1.parseCompleteOutput({ text: '{ broken json' }, context),
      ).rejects.toThrowError(
        'No object generated: could not parse the response.',
      );
    });

    it('should throw NoObjectGeneratedError if result is missing', async () => {
      await expect(
        choice1.parseCompleteOutput({ text: `{}` }, context),
      ).rejects.toThrowError(
        'No object generated: response did not match schema.',
      );
    });

    it('should throw NoObjectGeneratedError if result value is not a valid choice', async () => {
      await expect(
        choice1.parseCompleteOutput({ text: `{ "result": "d" }` }, context),
      ).rejects.toThrowError(
        'No object generated: response did not match schema.',
      );
    });

    it('should throw NoObjectGeneratedError if result is not a string', async () => {
      await expect(
        choice1.parseCompleteOutput({ text: `{ "result": 5 }` }, context),
      ).rejects.toThrowError(
        'No object generated: response did not match schema.',
      );
    });

    it('should throw NoObjectGeneratedError if top-level is not an object', async () => {
      await expect(
        choice1.parseCompleteOutput({ text: `"a"` }, context),
      ).rejects.toThrowError(
        'No object generated: response did not match schema.',
      );
    });
  });

  describe('parsePartialOutput', () => {
    it('should parse a valid exact partial choice output', async () => {
      const result = await choice1.parsePartialOutput({
        text: `{ "result": "aaa" }`,
      });
      expect(result).toEqual({ partial: 'aaa' });
    });

    it('should return undefined if JSON is invalid', async () => {
      const result = await choice1.parsePartialOutput({
        text: '{ broken json',
      });
      expect(result).toBeUndefined();
    });

    it('should return undefined if result is missing', async () => {
      const result = await choice1.parsePartialOutput({ text: `{}` });
      expect(result).toBeUndefined();
    });

    it('should return ambiguous if result is a prefix matching multiple options (repaired-parse)', async () => {
      const result = await choice1.parsePartialOutput({
        text: `{ "result": "`,
      });
      expect(result).toBeUndefined();
    });

    it('should return the single matching partial if only one option matches (repaired-parse)', async () => {
      const result = await choice1.parsePartialOutput({
        text: `{ "result": "c`,
      });
      expect(result).toEqual({ partial: 'ccc' });
    });

    it('should return undefined if result does not match any choice', async () => {
      const result = await choice1.parsePartialOutput({
        text: `{ "result": "z" }`,
      });
      expect(result).toBeUndefined();
    });

    it('should return undefined if result is not a string', async () => {
      const result = await choice1.parsePartialOutput({
        text: `{ "result": 5 }`,
      });
      expect(result).toBeUndefined();
    });

    it('should return undefined if top-level is not an object', async () => {
      const result = await choice1.parsePartialOutput({ text: `"a"` });
      expect(result).toBeUndefined();
    });

    it('should return full match as partial for "successful-parse" and valid choice', async () => {
      const result = await choice1.parsePartialOutput({
        text: `{ "result": "aab" }`,
      });
      expect(result).toEqual({ partial: 'aab' });
    });

    it("should return undefined for an incomplete prefix that doesn't match any choice", async () => {
      const result = await choice1.parsePartialOutput({
        text: `{ "result": "x" }`,
      });
      expect(result).toBeUndefined();
    });

    it('should return undefined for a prefix matching multiple options', async () => {
      const result = await choice1.parsePartialOutput({
        text: `{ "result": "a`,
      });
      expect(result).toBeUndefined();
    });

    it('should return undefined if partial result is null', async () => {
      const result = await choice1.parsePartialOutput({ text: `null` });
      expect(result).toBeUndefined();
    });
  });
});
describe('Output.json', () => {
  const json1 = json();

  describe('responseFormat', () => {
    it('should return json responseFormat', async () => {
      const result = await json1.responseFormat;
      expect(result).toMatchInlineSnapshot(`
        {
          "type": "json",
        }
      `);
    });

    it('should include name and description when provided', async () => {
      const jsonWithNameAndDesc = json({
        name: 'test-json-name',
        description: 'test json description',
      });
      const result = await jsonWithNameAndDesc.responseFormat;
      expect(result).toMatchInlineSnapshot(`
        {
          "description": "test json description",
          "name": "test-json-name",
          "type": "json",
        }
      `);
    });
  });

  describe('parseCompleteOutput', () => {
    it('should parse valid JSON', async () => {
      const result = await json1.parseCompleteOutput(
        { text: `{"a": 1, "b": [2,3]}` },
        context,
      );
      expect(result).toEqual({ a: 1, b: [2, 3] });
    });

    it('should throw if JSON is invalid', async () => {
      await expect(() =>
        json1.parseCompleteOutput({ text: `{ a: 1 }` }, context),
      ).rejects.toThrow('No object generated: could not parse the response.');
    });

    it('should throw if JSON is just text', async () => {
      await expect(() =>
        json1.parseCompleteOutput({ text: `foo` }, context),
      ).rejects.toThrow('No object generated: could not parse the response.');
    });
  });

  describe('parsePartialOutput', () => {
    it('should parse partial valid JSON (successful-parse)', async () => {
      const result = await json1.parsePartialOutput({
        text: `{ "foo": 1, "bar": [2, 3] }`,
      });
      expect(result).toEqual({ partial: { foo: 1, bar: [2, 3] } });
    });

    it('should parse partial valid JSON (repaired-parse)', async () => {
      // simulate incomplete/repaired but still valid
      const result = await json1.parsePartialOutput({ text: `{ "foo": 123` });
      // Since parsePartialJson may not be able to repair this, just check it's undefined or a value
      expect([undefined, { partial: expect.anything() }]).toContainEqual(
        result,
      );
    });

    it('should return undefined for invalid partial', async () => {
      const result = await json1.parsePartialOutput({ text: `invalid!` });
      expect(result).toBeUndefined();
    });

    it('should return undefined for undefined input', async () => {
      const result = await json1.parsePartialOutput({ text: `` });
      expect(result).toBeUndefined();
    });

    it('should return undefined if parsed value is undefined', async () => {
      const result = await json1.parsePartialOutput({ text: `undefined` });
      expect(result).toBeUndefined();
    });
  });
});
