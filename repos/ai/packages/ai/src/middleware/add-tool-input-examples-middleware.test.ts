import type { JSONObject, LanguageModelV4CallOptions } from '@ai-sdk/provider';
import { addToolInputExamplesMiddleware } from './add-tool-input-examples-middleware';
import { MockLanguageModelV4 } from '../test/mock-language-model-v4';
import { describe, it, expect } from 'vitest';

const BASE_PARAMS: LanguageModelV4CallOptions = {
  prompt: [
    { role: 'user', content: [{ type: 'text', text: 'Hello, world!' }] },
  ],
};

const MOCK_MODEL = new MockLanguageModelV4();

describe('addToolInputExamplesMiddleware', () => {
  describe('transformParams', () => {
    it('should append examples to tool description', async () => {
      const middleware = addToolInputExamplesMiddleware();

      const result = await middleware.transformParams!({
        type: 'generate',
        params: {
          ...BASE_PARAMS,
          tools: [
            {
              type: 'function',
              name: 'weather',
              description: 'Get the weather in a location',
              inputSchema: {
                type: 'object',
                properties: { location: { type: 'string' } },
              },
              inputExamples: [
                { input: { location: 'San Francisco' } },
                { input: { location: 'London' } },
              ],
            },
          ],
        },
        model: MOCK_MODEL,
      });

      expect(result.tools).toMatchInlineSnapshot(`
        [
          {
            "description": "Get the weather in a location

        Input Examples:
        {"location":"San Francisco"}
        {"location":"London"}",
            "inputExamples": undefined,
            "inputSchema": {
              "properties": {
                "location": {
                  "type": "string",
                },
              },
              "type": "object",
            },
            "name": "weather",
            "type": "function",
          },
        ]
      `);
    });

    it('should handle tool without existing description', async () => {
      const middleware = addToolInputExamplesMiddleware();

      const result = await middleware.transformParams!({
        type: 'generate',
        params: {
          ...BASE_PARAMS,
          tools: [
            {
              type: 'function',
              name: 'weather',
              inputSchema: {
                type: 'object',
                properties: { location: { type: 'string' } },
              },
              inputExamples: [{ input: { location: 'Berlin' } }],
            },
          ],
        },
        model: MOCK_MODEL,
      });

      expect(result.tools).toMatchInlineSnapshot(`
        [
          {
            "description": "Input Examples:
        {"location":"Berlin"}",
            "inputExamples": undefined,
            "inputSchema": {
              "properties": {
                "location": {
                  "type": "string",
                },
              },
              "type": "object",
            },
            "name": "weather",
            "type": "function",
          },
        ]
      `);
    });
  });

  describe('examplesPrefix', () => {
    it('should use provided examplesPrefix as header', async () => {
      const middleware = addToolInputExamplesMiddleware({
        prefix: 'Here are some example inputs:',
      });

      const result = await middleware.transformParams!({
        type: 'generate',
        params: {
          ...BASE_PARAMS,
          tools: [
            {
              type: 'function',
              name: 'weather',
              description: 'Get the weather',
              inputSchema: {
                type: 'object',
                properties: { location: { type: 'string' } },
              },
              inputExamples: [{ input: { location: 'Paris' } }],
            },
          ],
        },
        model: MOCK_MODEL,
      });

      expect((result.tools![0] as any).description).toMatchInlineSnapshot(`
        "Get the weather

        Here are some example inputs:
        {"location":"Paris"}"
      `);
    });
  });

  describe('formatExample', () => {
    it('should use default JSON.stringify format', async () => {
      const middleware = addToolInputExamplesMiddleware();

      const result = await middleware.transformParams!({
        type: 'generate',
        params: {
          ...BASE_PARAMS,
          tools: [
            {
              type: 'function',
              name: 'search',
              description: 'Search for items',
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                  limit: { type: 'number' },
                },
              },
              inputExamples: [{ input: { query: 'test', limit: 10 } }],
            },
          ],
        },
        model: MOCK_MODEL,
      });

      expect((result.tools![0] as any).description).toMatchInlineSnapshot(`
        "Search for items

        Input Examples:
        {"query":"test","limit":10}"
      `);
    });

    it('should use custom format function', async () => {
      const middleware = addToolInputExamplesMiddleware({
        format: (example: { input: JSONObject }, index: number) =>
          `${index + 1}. ${JSON.stringify(example.input)}`,
      });

      const result = await middleware.transformParams!({
        type: 'generate',
        params: {
          ...BASE_PARAMS,
          tools: [
            {
              type: 'function',
              name: 'weather',
              description: 'Get the weather',
              inputSchema: {
                type: 'object',
                properties: { location: { type: 'string' } },
              },
              inputExamples: [
                { input: { location: 'Paris' } },
                { input: { location: 'Tokyo' } },
              ],
            },
          ],
        },
        model: MOCK_MODEL,
      });

      expect((result.tools![0] as any).description).toMatchInlineSnapshot(`
        "Get the weather

        Input Examples:
        1. {"location":"Paris"}
        2. {"location":"Tokyo"}"
      `);
    });
  });

  describe('removeInputExamples', () => {
    it('should remove inputExamples by default', async () => {
      const middleware = addToolInputExamplesMiddleware();

      const result = await middleware.transformParams!({
        type: 'generate',
        params: {
          ...BASE_PARAMS,
          tools: [
            {
              type: 'function',
              name: 'weather',
              description: 'Get the weather',
              inputSchema: {
                type: 'object',
                properties: { location: { type: 'string' } },
              },
              inputExamples: [{ input: { location: 'NYC' } }],
            },
          ],
        },
        model: MOCK_MODEL,
      });

      expect((result.tools![0] as any).inputExamples).toBeUndefined();
    });

    it('should keep inputExamples when remove is false', async () => {
      const middleware = addToolInputExamplesMiddleware({
        remove: false,
      });

      const result = await middleware.transformParams!({
        type: 'generate',
        params: {
          ...BASE_PARAMS,
          tools: [
            {
              type: 'function',
              name: 'weather',
              description: 'Get the weather',
              inputSchema: {
                type: 'object',
                properties: { location: { type: 'string' } },
              },
              inputExamples: [{ input: { location: 'NYC' } }],
            },
          ],
        },
        model: MOCK_MODEL,
      });

      expect((result.tools![0] as any).inputExamples).toMatchInlineSnapshot(`
        [
          {
            "input": {
              "location": "NYC",
            },
          },
        ]
      `);
    });
  });

  describe('edge cases', () => {
    it('should pass through tools without inputExamples', async () => {
      const middleware = addToolInputExamplesMiddleware();

      const result = await middleware.transformParams!({
        type: 'generate',
        params: {
          ...BASE_PARAMS,
          tools: [
            {
              type: 'function',
              name: 'weather',
              description: 'Get the weather',
              inputSchema: {
                type: 'object',
                properties: { location: { type: 'string' } },
              },
            },
          ],
        },
        model: MOCK_MODEL,
      });

      expect(result.tools).toMatchInlineSnapshot(`
        [
          {
            "description": "Get the weather",
            "inputSchema": {
              "properties": {
                "location": {
                  "type": "string",
                },
              },
              "type": "object",
            },
            "name": "weather",
            "type": "function",
          },
        ]
      `);
    });

    it('should pass through tools with empty inputExamples array', async () => {
      const middleware = addToolInputExamplesMiddleware();

      const result = await middleware.transformParams!({
        type: 'generate',
        params: {
          ...BASE_PARAMS,
          tools: [
            {
              type: 'function',
              name: 'weather',
              description: 'Get the weather',
              inputSchema: {
                type: 'object',
                properties: { location: { type: 'string' } },
              },
              inputExamples: [],
            },
          ],
        },
        model: MOCK_MODEL,
      });

      expect((result.tools![0] as any).description).toBe('Get the weather');
    });

    it('should pass through provider tools unchanged', async () => {
      const middleware = addToolInputExamplesMiddleware();

      const result = await middleware.transformParams!({
        type: 'generate',
        params: {
          ...BASE_PARAMS,
          tools: [
            {
              type: 'provider',
              name: 'web_search',
              id: 'anthropic.web_search_20250305',
              args: { maxUses: 5 },
            },
          ],
        },
        model: MOCK_MODEL,
      });

      expect(result.tools).toMatchInlineSnapshot(`
        [
          {
            "args": {
              "maxUses": 5,
            },
            "id": "anthropic.web_search_20250305",
            "name": "web_search",
            "type": "provider",
          },
        ]
      `);
    });

    it('should handle multiple tools with mixed examples', async () => {
      const middleware = addToolInputExamplesMiddleware();

      const result = await middleware.transformParams!({
        type: 'generate',
        params: {
          ...BASE_PARAMS,
          tools: [
            {
              type: 'function',
              name: 'weather',
              description: 'Get the weather',
              inputSchema: {
                type: 'object',
                properties: { location: { type: 'string' } },
              },
              inputExamples: [{ input: { location: 'NYC' } }],
            },
            {
              type: 'function',
              name: 'time',
              description: 'Get the current time',
              inputSchema: {
                type: 'object',
                properties: { timezone: { type: 'string' } },
              },
            },
          ],
        },
        model: MOCK_MODEL,
      });

      expect(result.tools).toMatchInlineSnapshot(`
        [
          {
            "description": "Get the weather

        Input Examples:
        {"location":"NYC"}",
            "inputExamples": undefined,
            "inputSchema": {
              "properties": {
                "location": {
                  "type": "string",
                },
              },
              "type": "object",
            },
            "name": "weather",
            "type": "function",
          },
          {
            "description": "Get the current time",
            "inputSchema": {
              "properties": {
                "timezone": {
                  "type": "string",
                },
              },
              "type": "object",
            },
            "name": "time",
            "type": "function",
          },
        ]
      `);
    });

    it('should handle empty tools array', async () => {
      const middleware = addToolInputExamplesMiddleware();

      const result = await middleware.transformParams!({
        type: 'generate',
        params: { ...BASE_PARAMS, tools: [] },
        model: MOCK_MODEL,
      });

      expect(result.tools).toEqual([]);
    });

    it('should handle undefined tools', async () => {
      const middleware = addToolInputExamplesMiddleware();

      const result = await middleware.transformParams!({
        type: 'generate',
        params: { ...BASE_PARAMS, tools: undefined },
        model: MOCK_MODEL,
      });

      expect(result.tools).toBeUndefined();
    });
  });
});
