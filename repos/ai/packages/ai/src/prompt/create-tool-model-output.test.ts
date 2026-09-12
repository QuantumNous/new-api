import { tool, type Tool, type ToolResultOutput } from '@ai-sdk/provider-utils';
import { createToolModelOutput } from './create-tool-model-output';
import z from 'zod/v4';
import { describe, it, expect } from 'vitest';

describe('createToolModelOutput', () => {
  describe('error cases', () => {
    it('should return error type with string value when isError is true and output is string', async () => {
      const result = await createToolModelOutput({
        toolCallId: '123',
        input: {},
        output: 'Error message',
        tool: undefined,
        errorMode: 'text',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "type": "error-text",
          "value": "Error message",
        }
      `);
    });

    it('should return error type with JSON stringified value when isError is true and output is not string', async () => {
      const errorOutput = { error: 'Something went wrong', code: 500 };
      const result = await createToolModelOutput({
        toolCallId: '123',
        input: {},
        output: errorOutput,
        tool: undefined,
        errorMode: 'text',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "type": "error-text",
          "value": "{"error":"Something went wrong","code":500}",
        }
      `);
    });

    it('should return error type with JSON stringified value for complex objects', async () => {
      const complexError = {
        message: 'Complex error',
        details: {
          timestamp: '2023-01-01T00:00:00Z',
          stack: ['line1', 'line2'],
        },
      };
      const result = await createToolModelOutput({
        toolCallId: '123',
        input: {},
        output: complexError,
        tool: undefined,
        errorMode: 'text',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "type": "error-text",
          "value": "{"message":"Complex error","details":{"timestamp":"2023-01-01T00:00:00Z","stack":["line1","line2"]}}",
        }
      `);
    });
  });

  describe('tool with toModelOutput', () => {
    it('should use tool.toModelOutput when available', async () => {
      const mockTool = tool({
        inputSchema: z.object({}),
        toModelOutput: ({ output }) => ({
          type: 'text',
          value: `Custom output: ${output}`,
        }),
      });

      const result = await createToolModelOutput({
        toolCallId: '123',
        input: {},
        output: 'test output',
        tool: mockTool,
        errorMode: 'none',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "type": "text",
          "value": "Custom output: test output",
        }
      `);
    });

    it('should use tool.toModelOutput with complex output', async () => {
      const mockTool = tool({
        inputSchema: z.object({}),
        toModelOutput: ({ output }) => ({
          type: 'json',
          value: { processed: output, timestamp: '2023-01-01' },
        }),
      });

      const result = await createToolModelOutput({
        toolCallId: '123',
        input: {},
        output: { data: [1, 2, 3], status: 'success' },
        tool: mockTool,
        errorMode: 'none',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "type": "json",
          "value": {
            "processed": {
              "data": [
                1,
                2,
                3,
              ],
              "status": "success",
            },
            "timestamp": "2023-01-01",
          },
        }
      `);
    });

    it('should use tool.toModelOutput returning content type', async () => {
      const mockTool: Tool = {
        toModelOutput: () => ({
          type: 'content',
          value: [
            { type: 'text', text: 'Here is the result:' },
            { type: 'text', text: 'Additional information' },
          ],
        }),
        inputSchema: z.object({}),
      };

      const result = await createToolModelOutput({
        toolCallId: '123',
        input: {},
        output: 'any output',
        tool: mockTool,
        errorMode: 'none',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "type": "content",
          "value": [
            {
              "text": "Here is the result:",
              "type": "text",
            },
            {
              "text": "Additional information",
              "type": "text",
            },
          ],
        }
      `);
    });
  });

  describe('this binding', () => {
    // Guards against re-introducing a "this-binding guard" (e.g. destructuring
    // `toModelOutput` off the tool before calling it), which would break
    // class-based tools that rely on `this` in `toModelOutput`.
    // See https://github.com/vercel/ai/pull/15917#discussion_r3376474765
    it('should preserve `this` when calling a class-based tool.toModelOutput', async () => {
      class WeatherTool {
        readonly inputSchema = z.object({});
        private readonly unit = '°C';

        toModelOutput({ output }: { output: unknown }): ToolResultOutput {
          // accesses `this.unit`, which requires `this` to be bound to the
          // tool instance when `toModelOutput` is invoked.
          return { type: 'text', value: `${output}${this.unit}` };
        }
      }

      const result = await createToolModelOutput({
        toolCallId: '123',
        input: {},
        output: '21',
        tool: new WeatherTool(),
        errorMode: 'none',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "type": "text",
          "value": "21°C",
        }
      `);
    });
  });

  describe('string output without toModelOutput', () => {
    it('should return text type for string output', async () => {
      const result = await createToolModelOutput({
        toolCallId: '123',
        input: {},
        output: 'Simple string output',
        tool: undefined,
        errorMode: 'none',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "type": "text",
          "value": "Simple string output",
        }
      `);
    });

    it('should return text type for string output even with tool that has no toModelOutput', async () => {
      const result = await createToolModelOutput({
        toolCallId: '123',
        input: {},
        output: 'String output',
        tool: {
          description: 'A tool without toModelOutput',
          inputSchema: z.object({}),
        },
        errorMode: 'none',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "type": "text",
          "value": "String output",
        }
      `);
    });

    it('should return text type for empty string', async () => {
      const result = await createToolModelOutput({
        toolCallId: '123',
        input: {},
        output: '',
        tool: undefined,
        errorMode: 'none',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "type": "text",
          "value": "",
        }
      `);
    });
  });

  describe('non-string output without toModelOutput', () => {
    it('should return json type for object output', async () => {
      const result = await createToolModelOutput({
        toolCallId: '123',
        input: {},
        output: { result: 'success', data: [1, 2, 3] },
        tool: undefined,
        errorMode: 'none',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "type": "json",
          "value": {
            "data": [
              1,
              2,
              3,
            ],
            "result": "success",
          },
        }
      `);
    });

    it('should return json type for array output', async () => {
      const result = await createToolModelOutput({
        toolCallId: '123',
        input: {},
        output: [1, 2, 3, 'test'],
        tool: undefined,
        errorMode: 'none',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "type": "json",
          "value": [
            1,
            2,
            3,
            "test",
          ],
        }
      `);
    });

    it('should return json type for number output', async () => {
      const result = await createToolModelOutput({
        toolCallId: '123',
        input: {},
        output: 42,
        tool: undefined,
        errorMode: 'none',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "type": "json",
          "value": 42,
        }
      `);
    });

    it('should return json type for boolean output', async () => {
      const result = await createToolModelOutput({
        toolCallId: '123',
        input: {},
        output: true,
        tool: undefined,
        errorMode: 'none',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "type": "json",
          "value": true,
        }
      `);
    });

    it('should return json type for null output', async () => {
      const result = await createToolModelOutput({
        toolCallId: '123',
        input: {},
        output: null,
        tool: undefined,
        errorMode: 'none',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "type": "json",
          "value": null,
        }
      `);
    });

    it('should return json type for complex nested object', async () => {
      const result = await createToolModelOutput({
        toolCallId: '123',
        input: {},
        output: {
          user: {
            id: 123,
            name: 'John Doe',
            preferences: {
              theme: 'dark',
              notifications: true,
            },
          },
          metadata: {
            timestamp: '2023-01-01T00:00:00Z',
            version: '1.0.0',
          },
          items: [
            { id: 1, name: 'Item 1' },
            { id: 2, name: 'Item 2' },
          ],
        },
        tool: undefined,
        errorMode: 'none',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "type": "json",
          "value": {
            "items": [
              {
                "id": 1,
                "name": "Item 1",
              },
              {
                "id": 2,
                "name": "Item 2",
              },
            ],
            "metadata": {
              "timestamp": "2023-01-01T00:00:00Z",
              "version": "1.0.0",
            },
            "user": {
              "id": 123,
              "name": "John Doe",
              "preferences": {
                "notifications": true,
                "theme": "dark",
              },
            },
          },
        }
      `);
    });
  });

  describe('edge cases', () => {
    it('should prioritize isError over tool.toModelOutput', async () => {
      const mockTool: Tool = {
        inputSchema: z.object({}),
        toModelOutput: () => ({
          type: 'text',
          value: 'This should not be called',
        }),
      };

      const result = await createToolModelOutput({
        toolCallId: '123',
        input: {},
        output: 'Error occurred',
        tool: mockTool,
        errorMode: 'text',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "type": "error-text",
          "value": "Error occurred",
        }
      `);
    });

    it('should handle undefined output in error text case', async () => {
      const result = await createToolModelOutput({
        toolCallId: '123',
        input: {},
        output: undefined,
        tool: undefined,
        errorMode: 'text',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "type": "error-text",
          "value": "unknown error",
        }
      `);
    });

    it('should use null for undefined output in error json case', async () => {
      const result = await createToolModelOutput({
        toolCallId: '123',
        input: {},
        output: undefined,
        tool: undefined,
        errorMode: 'json',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "type": "error-json",
          "value": null,
        }
      `);
    });

    it('should use null for undefined output in non-error case', async () => {
      const result = await createToolModelOutput({
        toolCallId: '123',
        input: {},
        output: undefined,
        tool: undefined,
        errorMode: 'none',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "type": "json",
          "value": null,
        }
      `);
    });
  });

  describe('arguments', () => {
    it('should pass toolCallId to tool.toModelOutput', async () => {
      const mockTool: Tool = {
        inputSchema: z.object({}),
        toModelOutput: ({ toolCallId }) => ({
          type: 'text',
          value: `Tool call ID: ${toolCallId}`,
        }),
      };

      const result = await createToolModelOutput({
        toolCallId: '2344',
        input: {},
        output: 'test',
        tool: mockTool,
        errorMode: 'none',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "type": "text",
          "value": "Tool call ID: 2344",
        }
      `);
    });

    it('should pass input to tool.toModelOutput', async () => {
      const mockTool: Tool = {
        inputSchema: z.object({ number: z.number() }),
        toModelOutput: ({ input }) => ({
          type: 'text',
          value: `Input: ${input.number}`,
        }),
      };

      const result = await createToolModelOutput({
        toolCallId: '2344',
        input: { number: 8877 },
        output: 'test',
        tool: mockTool,
        errorMode: 'none',
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "type": "text",
          "value": "Input: 8877",
        }
      `);
    });
  });
});
