import type { LanguageModelV4FunctionTool } from '@ai-sdk/provider';
import { describe, expect, it } from 'vitest';
import { prepareGoogleInteractionsTools } from './prepare-google-interactions-tools';

const FUNCTION_TOOL: LanguageModelV4FunctionTool = {
  type: 'function',
  name: 'getWeather',
  description: 'Get the current weather in a location',
  inputSchema: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'City name' },
    },
    required: ['location'],
  },
};

describe('prepareGoogleInteractionsTools', () => {
  it('returns undefined tools/toolChoice and no warnings when no tools are provided', () => {
    const result = prepareGoogleInteractionsTools({ tools: undefined });
    expect(result).toEqual({
      tools: undefined,
      toolChoice: undefined,
      toolWarnings: [],
    });
  });

  it('treats an empty tools array as no tools', () => {
    const result = prepareGoogleInteractionsTools({ tools: [] });
    expect(result).toEqual({
      tools: undefined,
      toolChoice: undefined,
      toolWarnings: [],
    });
  });

  it('maps an AI SDK function tool to an Interactions function tool with passthrough JSON Schema', () => {
    const result = prepareGoogleInteractionsTools({
      tools: [FUNCTION_TOOL],
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "toolChoice": undefined,
        "toolWarnings": [],
        "tools": [
          {
            "description": "Get the current weather in a location",
            "name": "getWeather",
            "parameters": {
              "properties": {
                "location": {
                  "description": "City name",
                  "type": "string",
                },
              },
              "required": [
                "location",
              ],
              "type": "object",
            },
            "type": "function",
          },
        ],
      }
    `);
  });

  it('emits an empty description string when the tool has none', () => {
    const result = prepareGoogleInteractionsTools({
      tools: [{ ...FUNCTION_TOOL, description: undefined }],
    });
    expect(result.tools?.[0]).toEqual({
      type: 'function',
      name: 'getWeather',
      description: '',
      parameters: FUNCTION_TOOL.inputSchema,
    });
  });

  describe('provider-defined tools', () => {
    const cases: Array<{
      title: string;
      id: `${string}.${string}`;
      args: Record<string, unknown>;
      expected: Record<string, unknown>;
    }> = [
      {
        title: 'google.google_search (no args)',
        id: 'google.google_search',
        args: {},
        expected: { type: 'google_search' },
      },
      {
        title: 'google.google_search with searchTypes',
        id: 'google.google_search',
        args: { searchTypes: { webSearch: {}, imageSearch: {} } },
        expected: {
          type: 'google_search',
          search_types: ['web_search', 'image_search'],
        },
      },
      {
        title: 'google.code_execution',
        id: 'google.code_execution',
        args: {},
        expected: { type: 'code_execution' },
      },
      {
        title: 'google.url_context',
        id: 'google.url_context',
        args: {},
        expected: { type: 'url_context' },
      },
      {
        title: 'google.file_search',
        id: 'google.file_search',
        args: {
          fileSearchStoreNames: ['fileSearchStores/foo'],
          topK: 4,
          metadataFilter: 'a = "b"',
        },
        expected: {
          type: 'file_search',
          file_search_store_names: ['fileSearchStores/foo'],
          top_k: 4,
          metadata_filter: 'a = "b"',
        },
      },
      {
        title: 'google.google_maps',
        id: 'google.google_maps',
        args: { latitude: 37.7749, longitude: -122.4194, enableWidget: true },
        expected: {
          type: 'google_maps',
          latitude: 37.7749,
          longitude: -122.4194,
          enable_widget: true,
        },
      },
      {
        title: 'google.computer_use',
        id: 'google.computer_use',
        args: {},
        expected: { type: 'computer_use', environment: 'browser' },
      },
      {
        title: 'google.mcp_server',
        id: 'google.mcp_server',
        args: {
          name: 'my-mcp',
          url: 'https://example.com/mcp',
          headers: { Authorization: 'Bearer x' },
          allowedTools: ['foo'],
        },
        expected: {
          type: 'mcp_server',
          name: 'my-mcp',
          url: 'https://example.com/mcp',
          headers: { Authorization: 'Bearer x' },
          allowed_tools: ['foo'],
        },
      },
      {
        title: 'google.retrieval',
        id: 'google.retrieval',
        args: {
          retrievalTypes: ['vertex_ai_search'],
          vertexAiSearchConfig: {
            datastores: ['projects/p/locations/l/dataStores/d'],
          },
        },
        expected: {
          type: 'retrieval',
          retrieval_types: ['vertex_ai_search'],
          vertex_ai_search_config: {
            datastores: ['projects/p/locations/l/dataStores/d'],
          },
        },
      },
    ];

    for (const { title, id, args, expected } of cases) {
      it(`maps ${title}`, () => {
        const result = prepareGoogleInteractionsTools({
          tools: [
            {
              type: 'provider',
              id,
              name: id.split('.')[1],
              args,
            },
          ],
        });
        expect(result.toolWarnings).toEqual([]);
        expect(result.tools).toEqual([expected]);
      });
    }

    it('warns and drops unknown google.* provider-defined tools', () => {
      const result = prepareGoogleInteractionsTools({
        tools: [
          {
            type: 'provider',
            id: 'google.unknown_tool',
            name: 'unknown_tool',
            args: {},
          },
        ],
      });
      expect(result.tools).toBeUndefined();
      expect(result.toolWarnings).toMatchInlineSnapshot(`
        [
          {
            "details": "provider-defined tool google.unknown_tool is not supported by google.interactions; tool dropped.",
            "feature": "provider-defined tool google.unknown_tool",
            "type": "unsupported",
          },
        ]
      `);
    });
  });

  describe('toolChoice mapping', () => {
    it('maps "auto" to "auto"', () => {
      const result = prepareGoogleInteractionsTools({
        tools: [FUNCTION_TOOL],
        toolChoice: { type: 'auto' },
      });
      expect(result.toolChoice).toBe('auto');
    });

    it('maps "required" to "any"', () => {
      const result = prepareGoogleInteractionsTools({
        tools: [FUNCTION_TOOL],
        toolChoice: { type: 'required' },
      });
      expect(result.toolChoice).toBe('any');
    });

    it('maps "none" to "none"', () => {
      const result = prepareGoogleInteractionsTools({
        tools: [FUNCTION_TOOL],
        toolChoice: { type: 'none' },
      });
      expect(result.toolChoice).toBe('none');
    });

    it('maps { type: "tool", toolName } to { allowed_tools: { mode: "validated", tools: [name] } }', () => {
      const result = prepareGoogleInteractionsTools({
        tools: [FUNCTION_TOOL],
        toolChoice: { type: 'tool', toolName: 'getWeather' },
      });
      expect(result.toolChoice).toMatchInlineSnapshot(`
        {
          "allowed_tools": {
            "mode": "validated",
            "tools": [
              "getWeather",
            ],
          },
        }
      `);
    });
  });
});
