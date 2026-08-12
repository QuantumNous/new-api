import type { LanguageModelV4ProviderTool } from '@ai-sdk/provider';
import { expect, it } from 'vitest';
import { prepareTools } from './google-prepare-tools';

it('should return undefined tools and tool_choice when tools are null', () => {
  const result = prepareTools({
    tools: undefined,
    modelId: 'gemini-2.5-flash',
  });
  expect(result).toEqual({
    tools: undefined,
    tool_choice: undefined,
    toolWarnings: [],
  });
});

it('should return undefined tools and tool_choice when tools are empty', () => {
  const result = prepareTools({ tools: [], modelId: 'gemini-2.5-flash' });
  expect(result).toEqual({
    tools: undefined,
    tool_choice: undefined,
    toolWarnings: [],
  });
});

it('should correctly prepare function tools', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'function',
        name: 'testFunction',
        description: 'A test function',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
    modelId: 'gemini-2.5-flash',
  });
  expect(result.tools).toEqual([
    {
      functionDeclarations: [
        {
          name: 'testFunction',
          description: 'A test function',
          parameters: undefined,
        },
      ],
    },
  ]);
  expect(result.toolConfig).toBeUndefined();
  expect(result.toolWarnings).toEqual([]);
});

it('should correctly prepare provider-defined tools as array', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'provider',
        id: 'google.google_search',
        name: 'google_search',
        args: {},
      },
      {
        type: 'provider',
        id: 'google.url_context',
        name: 'url_context',
        args: {},
      },
      {
        type: 'provider',
        id: 'google.file_search',
        name: 'file_search',
        args: { fileSearchStoreNames: ['projects/foo/fileSearchStores/bar'] },
      },
    ],
    modelId: 'gemini-2.5-flash',
  });
  expect(result.tools).toEqual([
    { googleSearch: {} },
    { urlContext: {} },
    {
      fileSearch: {
        fileSearchStoreNames: ['projects/foo/fileSearchStores/bar'],
      },
    },
  ]);
  expect(result.toolConfig).toBeUndefined();
  expect(result.toolWarnings).toEqual([]);
});

it('should correctly prepare single provider-defined tool', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'provider',
        id: 'google.google_search',
        name: 'google_search',
        args: {},
      },
    ],
    modelId: 'gemini-2.5-flash',
  });
  expect(result.tools).toEqual([{ googleSearch: {} }]);
  expect(result.toolConfig).toBeUndefined();
  expect(result.toolWarnings).toEqual([]);
});

it('should add warnings for unsupported tools', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'provider',
        id: 'unsupported.tool',
        name: 'unsupported_tool',
        args: {},
      },
    ],
    modelId: 'gemini-2.5-flash',
  });
  expect(result.tools).toBeUndefined();
  expect(result.toolConfig).toBeUndefined();
  expect(result.toolWarnings).toMatchInlineSnapshot(`
    [
      {
        "feature": "provider-defined tool unsupported.tool",
        "type": "unsupported",
      },
    ]
  `);
});

it('should add warnings for file search on unsupported models', () => {
  const tool: LanguageModelV4ProviderTool = {
    type: 'provider' as const,
    id: 'google.file_search',
    name: 'file_search',
    args: { fileSearchStoreNames: ['projects/foo/fileSearchStores/bar'] },
  };

  const result = prepareTools({
    tools: [tool],
    modelId: 'gemini-1.5-flash-8b',
  });

  expect(result.tools).toBeUndefined();
  expect(result.toolWarnings).toMatchInlineSnapshot(`
    [
      {
        "details": "The file search tool is only supported with Gemini 2.5 models and Gemini 3 models.",
        "feature": "provider-defined tool google.file_search",
        "type": "unsupported",
      },
    ]
  `);
});

it('should correctly prepare file search tool for gemini-2.5 models', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'provider',
        id: 'google.file_search',
        name: 'file_search',
        args: {
          fileSearchStoreNames: ['projects/foo/fileSearchStores/bar'],
          metadataFilter: 'author=Robert Graves',
          topK: 5,
        },
      },
    ],
    modelId: 'gemini-2.5-pro',
  });

  expect(result.tools).toEqual([
    {
      fileSearch: {
        fileSearchStoreNames: ['projects/foo/fileSearchStores/bar'],
        metadataFilter: 'author=Robert Graves',
        topK: 5,
      },
    },
  ]);
  expect(result.toolWarnings).toEqual([]);
});

it('should correctly prepare file search tool for gemini-3 models', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'provider',
        id: 'google.file_search',
        name: 'file_search',
        args: {
          fileSearchStoreNames: ['projects/foo/fileSearchStores/bar'],
          metadataFilter: 'author=Robert Graves',
          topK: 5,
        },
      },
    ],
    modelId: 'gemini-3.1-pro-preview',
  });

  expect(result.tools).toEqual([
    {
      fileSearch: {
        fileSearchStoreNames: ['projects/foo/fileSearchStores/bar'],
        metadataFilter: 'author=Robert Graves',
        topK: 5,
      },
    },
  ]);
  expect(result.toolWarnings).toEqual([]);
});

it('should handle tool choice "auto"', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'function',
        name: 'testFunction',
        description: 'Test',
        inputSchema: {},
      },
    ],
    toolChoice: { type: 'auto' },
    modelId: 'gemini-2.5-flash',
  });
  expect(result.toolConfig).toEqual({
    functionCallingConfig: { mode: 'AUTO' },
  });
});

it('should handle tool choice "required"', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'function',
        name: 'testFunction',
        description: 'Test',
        inputSchema: {},
      },
    ],
    toolChoice: { type: 'required' },
    modelId: 'gemini-2.5-flash',
  });
  expect(result.toolConfig).toEqual({
    functionCallingConfig: { mode: 'ANY' },
  });
});

it('should handle tool choice "none"', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'function',
        name: 'testFunction',
        description: 'Test',
        inputSchema: {},
      },
    ],
    toolChoice: { type: 'none' },
    modelId: 'gemini-2.5-flash',
  });
  expect(result.tools).toEqual([
    {
      functionDeclarations: [
        {
          name: 'testFunction',
          description: 'Test',
          parameters: {},
        },
      ],
    },
  ]);
  expect(result.toolConfig).toEqual({
    functionCallingConfig: { mode: 'NONE' },
  });
});

it('should handle tool choice "tool"', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'function',
        name: 'testFunction',
        description: 'Test',
        inputSchema: {},
      },
    ],
    toolChoice: { type: 'tool', toolName: 'testFunction' },
    modelId: 'gemini-2.5-flash',
  });
  expect(result.toolConfig).toEqual({
    functionCallingConfig: {
      mode: 'ANY',
      allowedFunctionNames: ['testFunction'],
    },
  });
});

it('should warn when mixing function and provider-defined tools', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'function',
        name: 'testFunction',
        description: 'A test function',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        type: 'provider',
        id: 'google.google_search',
        name: 'google_search',
        args: {},
      },
    ],
    modelId: 'gemini-2.5-flash',
  });

  expect(result.tools).toEqual([{ googleSearch: {} }]);

  expect(result.toolWarnings).toMatchInlineSnapshot(`
    [
      {
        "feature": "combination of function and provider-defined tools",
        "type": "unsupported",
      },
    ]
  `);

  expect(result.toolConfig).toBeUndefined();
});

it('should handle tool choice with mixed tools (provider-defined tools only)', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'function',
        name: 'testFunction',
        description: 'A test function',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        type: 'provider',
        id: 'google.google_search',
        name: 'google_search',
        args: {},
      },
    ],
    toolChoice: { type: 'auto' },
    modelId: 'gemini-2.5-flash',
  });

  expect(result.tools).toEqual([{ googleSearch: {} }]);

  expect(result.toolConfig).toEqual(undefined);

  expect(result.toolWarnings).toMatchInlineSnapshot(`
    [
      {
        "feature": "combination of function and provider-defined tools",
        "type": "unsupported",
      },
    ]
  `);
});

it('should combine function and provider-defined tools on Gemini 3 models', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'function',
        name: 'testFunction',
        description: 'A test function',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        type: 'provider',
        id: 'google.google_search',
        name: 'google_search',
        args: {},
      },
    ],
    modelId: 'gemini-3.1-flash-lite-preview',
  });

  expect(result.tools).toEqual([
    { googleSearch: {} },
    {
      functionDeclarations: [
        {
          name: 'testFunction',
          description: 'A test function',
          parameters: undefined,
        },
      ],
    },
  ]);

  expect(result.toolConfig).toEqual({
    functionCallingConfig: { mode: 'VALIDATED' },
    includeServerSideToolInvocations: true,
  });

  expect(result.toolWarnings).toEqual([]);
});

it('should omit server-side tool invocation flag for Vertex Gemini 3', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'function',
        name: 'testFunction',
        description: 'A test function',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        type: 'provider',
        id: 'google.google_search',
        name: 'google_search',
        args: {},
      },
    ],
    modelId: 'gemini-3-flash-preview',
    isVertexProvider: true,
  });

  expect(result).toMatchInlineSnapshot(`
    {
      "toolConfig": {
        "functionCallingConfig": {
          "mode": "VALIDATED",
        },
      },
      "toolWarnings": [],
      "tools": [
        {
          "googleSearch": {},
        },
        {
          "functionDeclarations": [
            {
              "description": "A test function",
              "name": "testFunction",
              "parameters": undefined,
            },
          ],
        },
      ],
    }
  `);
});

it('should combine multiple provider tools with function tools on Gemini 3', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'function',
        name: 'getWeather',
        description: 'Get weather',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        type: 'function',
        name: 'bookVenue',
        description: 'Book a venue',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        type: 'provider',
        id: 'google.google_search',
        name: 'google_search',
        args: {},
      },
      {
        type: 'provider',
        id: 'google.google_maps',
        name: 'google_maps',
        args: {},
      },
    ],
    modelId: 'gemini-3-flash-preview',
  });

  expect(result.tools).toEqual([
    { googleSearch: {} },
    { googleMaps: {} },
    {
      functionDeclarations: [
        {
          name: 'getWeather',
          description: 'Get weather',
          parameters: undefined,
        },
        {
          name: 'bookVenue',
          description: 'Book a venue',
          parameters: undefined,
        },
      ],
    },
  ]);

  expect(result.toolConfig).toEqual({
    functionCallingConfig: { mode: 'VALIDATED' },
    includeServerSideToolInvocations: true,
  });

  expect(result.toolWarnings).toEqual([]);
});

it('should use VALIDATED mode for combined tools with toolChoice auto on Gemini 3', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'function',
        name: 'testFunction',
        description: 'A test function',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        type: 'provider',
        id: 'google.google_search',
        name: 'google_search',
        args: {},
      },
    ],
    toolChoice: { type: 'auto' },
    modelId: 'gemini-3-flash-preview',
  });

  expect(result.toolConfig).toEqual({
    functionCallingConfig: { mode: 'VALIDATED' },
    includeServerSideToolInvocations: true,
  });

  expect(result.toolWarnings).toEqual([]);
});

it('should use ANY mode for combined tools with toolChoice required on Gemini 3', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'function',
        name: 'testFunction',
        description: 'A test function',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        type: 'provider',
        id: 'google.google_search',
        name: 'google_search',
        args: {},
      },
    ],
    toolChoice: { type: 'required' },
    modelId: 'gemini-3-flash-preview',
  });

  expect(result.toolConfig).toEqual({
    functionCallingConfig: { mode: 'ANY' },
    includeServerSideToolInvocations: true,
  });
});

it('should use NONE mode for combined tools with toolChoice none on Gemini 3', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'function',
        name: 'testFunction',
        description: 'A test function',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        type: 'provider',
        id: 'google.google_search',
        name: 'google_search',
        args: {},
      },
    ],
    toolChoice: { type: 'none' },
    modelId: 'gemini-3-flash-preview',
  });

  expect(result.toolConfig).toEqual({
    functionCallingConfig: { mode: 'NONE' },
    includeServerSideToolInvocations: true,
  });
});

it('should use ANY mode with allowedFunctionNames for combined tools with specific tool choice on Gemini 3', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'function',
        name: 'testFunction',
        description: 'A test function',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        type: 'provider',
        id: 'google.google_search',
        name: 'google_search',
        args: {},
      },
    ],
    toolChoice: { type: 'tool', toolName: 'testFunction' },
    modelId: 'gemini-3-flash-preview',
  });

  expect(result.toolConfig).toEqual({
    functionCallingConfig: {
      mode: 'ANY',
      allowedFunctionNames: ['testFunction'],
    },
    includeServerSideToolInvocations: true,
  });
});

it('should handle latest modelId for provider-defined tools correctly', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'provider',
        id: 'google.google_search',
        name: 'google_search',
        args: {},
      },
    ],
    modelId: 'gemini-flash-latest',
  });
  expect(result.tools).toEqual([{ googleSearch: {} }]);
  expect(result.toolConfig).toBeUndefined();
  expect(result.toolWarnings).toEqual([]);
});

it('should handle gemini-3 modelId for provider-defined tools correctly', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'provider',
        id: 'google.google_search',
        name: 'google_search',
        args: {},
      },
    ],
    modelId: 'gemini-3.1-pro-preview',
  });
  expect(result.tools).toEqual([{ googleSearch: {} }]);
  expect(result.toolConfig).toBeUndefined();
  expect(result.toolWarnings).toEqual([]);
});

it('should handle code execution tool', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'provider',
        id: 'google.code_execution',
        name: 'code_execution',
        args: {},
      },
    ],
    modelId: 'gemini-2.5-flash',
  });
  expect(result.tools).toEqual([{ codeExecution: {} }]);
  expect(result.toolConfig).toBeUndefined();
  expect(result.toolWarnings).toEqual([]);
});

it('should handle url context tool alone', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'provider',
        id: 'google.url_context',
        name: 'url_context',
        args: {},
      },
    ],
    modelId: 'gemini-2.5-flash',
  });
  expect(result.tools).toEqual([{ urlContext: {} }]);
  expect(result.toolConfig).toBeUndefined();
  expect(result.toolWarnings).toEqual([]);
});

it('should handle google maps tool', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'provider',
        id: 'google.google_maps',
        name: 'google_maps',
        args: {},
      },
    ],
    modelId: 'gemini-2.5-flash',
  });
  expect(result.tools).toEqual([{ googleMaps: {} }]);
  expect(result.toolConfig).toBeUndefined();
  expect(result.toolWarnings).toEqual([]);
});

it('should pass searchTypes args through for google search', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'provider',
        id: 'google.google_search',
        name: 'google_search',
        args: {
          searchTypes: { webSearch: {}, imageSearch: {} },
        },
      },
    ],
    modelId: 'gemini-3.1-flash-image-preview',
  });
  expect(result.tools).toEqual([
    {
      googleSearch: {
        searchTypes: { webSearch: {}, imageSearch: {} },
      },
    },
  ]);
  expect(result.toolWarnings).toEqual([]);
});

it('should pass timeRangeFilter args through for google search', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'provider',
        id: 'google.google_search',
        name: 'google_search',
        args: {
          timeRangeFilter: {
            startTime: '2025-01-01T00:00:00Z',
            endTime: '2025-12-31T23:59:59Z',
          },
        },
      },
    ],
    modelId: 'gemini-2.5-flash',
  });
  expect(result.tools).toEqual([
    {
      googleSearch: {
        timeRangeFilter: {
          startTime: '2025-01-01T00:00:00Z',
          endTime: '2025-12-31T23:59:59Z',
        },
      },
    },
  ]);
  expect(result.toolWarnings).toEqual([]);
});

it('should add warnings for google search on unsupported models', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'provider',
        id: 'google.google_search',
        name: 'google_search',
        args: {},
      },
    ],
    modelId: 'gemini-1.5-flash',
  });
  expect(result.tools).toBeUndefined();
  expect(result.toolWarnings).toMatchInlineSnapshot(`
    [
      {
        "details": "Google Search requires Gemini 2.0 or newer.",
        "feature": "provider-defined tool google.google_search",
        "type": "unsupported",
      },
    ]
  `);
});

it('should add warnings for google maps on unsupported models', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'provider',
        id: 'google.google_maps',
        name: 'google_maps',
        args: {},
      },
    ],
    modelId: 'gemini-1.5-flash',
  });
  expect(result.tools).toBeUndefined();
  expect(result.toolWarnings).toMatchInlineSnapshot(`
    [
      {
        "details": "The Google Maps grounding tool is not supported with Gemini models other than Gemini 2 or newer.",
        "feature": "provider-defined tool google.google_maps",
        "type": "unsupported",
      },
    ]
  `);
});

it('should use VALIDATED mode when any function tool has strict: true', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'function',
        name: 'createMeeting',
        description: 'Create a meeting',
        inputSchema: {
          type: 'object',
          properties: { title: { type: 'string' } },
          required: ['title'],
          additionalProperties: false,
        },
        strict: true,
      },
    ],
    modelId: 'gemini-3-flash-preview',
  });
  expect(result.toolConfig).toEqual({
    functionCallingConfig: { mode: 'VALIDATED' },
  });
  expect(result.toolWarnings).toEqual([]);
});

it('should use VALIDATED mode with toolChoice auto when strict: true', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'function',
        name: 'getWeather',
        description: 'Get weather',
        inputSchema: {
          type: 'object',
          properties: { city: { type: 'string' } },
          required: ['city'],
          additionalProperties: false,
        },
        strict: true,
      },
    ],
    toolChoice: { type: 'auto' },
    modelId: 'gemini-3-flash-preview',
  });
  expect(result.toolConfig).toEqual({
    functionCallingConfig: { mode: 'VALIDATED' },
  });
});

it('should use VALIDATED mode with toolChoice required when strict: true', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'function',
        name: 'getWeather',
        description: 'Get weather',
        inputSchema: {
          type: 'object',
          properties: { city: { type: 'string' } },
          required: ['city'],
          additionalProperties: false,
        },
        strict: true,
      },
    ],
    toolChoice: { type: 'required' },
    modelId: 'gemini-3-flash-preview',
  });
  expect(result.toolConfig).toEqual({
    functionCallingConfig: { mode: 'VALIDATED' },
  });
});

it('should use AUTO mode when no tools have strict: true', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'function',
        name: 'getWeather',
        description: 'Get weather',
        inputSchema: {
          type: 'object',
          properties: { city: { type: 'string' } },
          required: ['city'],
          additionalProperties: false,
        },
      },
    ],
    toolChoice: { type: 'auto' },
    modelId: 'gemini-3-flash-preview',
  });
  expect(result.toolConfig).toEqual({
    functionCallingConfig: { mode: 'AUTO' },
  });
});
