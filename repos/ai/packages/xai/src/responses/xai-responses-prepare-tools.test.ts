import { describe, expect, it } from 'vitest';
import { prepareResponsesTools } from './xai-responses-prepare-tools';

describe('prepareResponsesTools', () => {
  describe('web_search', () => {
    it('should prepare web_search tool with no args', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'provider',
            id: 'xai.web_search',
            name: 'web_search',
            args: {},
          },
        ],
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "allowed_domains": undefined,
              "enable_image_search": undefined,
              "enable_image_understanding": undefined,
              "excluded_domains": undefined,
              "type": "web_search",
            },
          ],
        }
      `);
    });

    it('should prepare web_search tool with allowed domains', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'provider',
            id: 'xai.web_search',
            name: 'web_search',
            args: {
              allowedDomains: ['wikipedia.org', 'example.com'],
            },
          },
        ],
      });

      expect(result.tools).toMatchInlineSnapshot(`
        [
          {
            "allowed_domains": [
              "wikipedia.org",
              "example.com",
            ],
            "enable_image_search": undefined,
            "enable_image_understanding": undefined,
            "excluded_domains": undefined,
            "type": "web_search",
          },
        ]
      `);
    });

    it('should prepare web_search tool with excluded domains', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'provider',
            id: 'xai.web_search',
            name: 'web_search',
            args: {
              excludedDomains: ['spam.com'],
            },
          },
        ],
      });

      expect(result.tools).toMatchInlineSnapshot(`
        [
          {
            "allowed_domains": undefined,
            "enable_image_search": undefined,
            "enable_image_understanding": undefined,
            "excluded_domains": [
              "spam.com",
            ],
            "type": "web_search",
          },
        ]
      `);
    });

    it('should prepare web_search tool with image search', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'provider',
            id: 'xai.web_search',
            name: 'web_search',
            args: {
              enableImageSearch: true,
            },
          },
        ],
      });

      expect(result.tools).toMatchInlineSnapshot(`
        [
          {
            "allowed_domains": undefined,
            "enable_image_search": true,
            "enable_image_understanding": undefined,
            "excluded_domains": undefined,
            "type": "web_search",
          },
        ]
      `);
    });

    it('should prepare web_search tool with image understanding', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'provider',
            id: 'xai.web_search',
            name: 'web_search',
            args: {
              enableImageUnderstanding: true,
            },
          },
        ],
      });

      expect(result.tools).toMatchInlineSnapshot(`
        [
          {
            "allowed_domains": undefined,
            "enable_image_search": undefined,
            "enable_image_understanding": true,
            "excluded_domains": undefined,
            "type": "web_search",
          },
        ]
      `);
    });
  });

  describe('x_search', () => {
    it('should prepare x_search tool with no args', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'provider',
            id: 'xai.x_search',
            name: 'x_search',
            args: {},
          },
        ],
      });

      expect(result.tools).toMatchInlineSnapshot(`
        [
          {
            "allowed_x_handles": undefined,
            "enable_image_understanding": undefined,
            "enable_video_understanding": undefined,
            "excluded_x_handles": undefined,
            "from_date": undefined,
            "to_date": undefined,
            "type": "x_search",
          },
        ]
      `);
    });

    it('should prepare x_search tool with allowed handles', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'provider',
            id: 'xai.x_search',
            name: 'x_search',
            args: {
              allowedXHandles: ['elonmusk', 'xai'],
            },
          },
        ],
      });

      expect(result.tools).toMatchInlineSnapshot(`
        [
          {
            "allowed_x_handles": [
              "elonmusk",
              "xai",
            ],
            "enable_image_understanding": undefined,
            "enable_video_understanding": undefined,
            "excluded_x_handles": undefined,
            "from_date": undefined,
            "to_date": undefined,
            "type": "x_search",
          },
        ]
      `);
    });

    it('should prepare x_search tool with date range', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'provider',
            id: 'xai.x_search',
            name: 'x_search',
            args: {
              fromDate: '2025-01-01',
              toDate: '2025-12-31',
            },
          },
        ],
      });

      expect(result.tools).toMatchInlineSnapshot(`
        [
          {
            "allowed_x_handles": undefined,
            "enable_image_understanding": undefined,
            "enable_video_understanding": undefined,
            "excluded_x_handles": undefined,
            "from_date": "2025-01-01",
            "to_date": "2025-12-31",
            "type": "x_search",
          },
        ]
      `);
    });

    it('should prepare x_search tool with video understanding', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'provider',
            id: 'xai.x_search',
            name: 'x_search',
            args: {
              enableVideoUnderstanding: true,
              enableImageUnderstanding: true,
            },
          },
        ],
      });

      expect(result.tools).toMatchInlineSnapshot(`
        [
          {
            "allowed_x_handles": undefined,
            "enable_image_understanding": true,
            "enable_video_understanding": true,
            "excluded_x_handles": undefined,
            "from_date": undefined,
            "to_date": undefined,
            "type": "x_search",
          },
        ]
      `);
    });
  });

  describe('code_execution', () => {
    it('should prepare code_execution tool as code_interpreter', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'provider',
            id: 'xai.code_execution',
            name: 'code_execution',
            args: {},
          },
        ],
      });

      expect(result.tools).toMatchInlineSnapshot(`
        [
          {
            "type": "code_interpreter",
          },
        ]
      `);
    });
  });

  describe('view_image', () => {
    it('should prepare view_image tool', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'provider',
            id: 'xai.view_image',
            name: 'view_image',
            args: {},
          },
        ],
      });

      expect(result.tools).toEqual([{ type: 'view_image' }]);
    });
  });

  describe('view_x_video', () => {
    it('should prepare view_x_video tool', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'provider',
            id: 'xai.view_x_video',
            name: 'view_x_video',
            args: {},
          },
        ],
      });

      expect(result.tools).toEqual([{ type: 'view_x_video' }]);
    });
  });

  describe('file_search', () => {
    it('should prepare file_search tool with vector store IDs', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'provider',
            id: 'xai.file_search',
            name: 'file_search',
            args: {
              vectorStoreIds: ['collection_1', 'collection_2'],
            },
          },
        ],
      });

      expect(result.tools).toMatchInlineSnapshot(`
        [
          {
            "max_num_results": undefined,
            "type": "file_search",
            "vector_store_ids": [
              "collection_1",
              "collection_2",
            ],
          },
        ]
      `);
    });

    it('should prepare file_search tool with max num results', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'provider',
            id: 'xai.file_search',
            name: 'file_search',
            args: {
              vectorStoreIds: ['collection_1'],
              maxNumResults: 10,
            },
          },
        ],
      });

      expect(result.tools).toMatchInlineSnapshot(`
        [
          {
            "max_num_results": 10,
            "type": "file_search",
            "vector_store_ids": [
              "collection_1",
            ],
          },
        ]
      `);
    });

    it('should handle multiple tools including file_search', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'provider',
            id: 'xai.web_search',
            name: 'web_search',
            args: {},
          },
          {
            type: 'provider',
            id: 'xai.file_search',
            name: 'file_search',
            args: {
              vectorStoreIds: ['collection_1'],
            },
          },
          {
            type: 'function',
            name: 'calculator',
            description: 'calculate numbers',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      });

      expect(result.tools).toHaveLength(3);
      expect(result.tools?.[0].type).toBe('web_search');
      expect(result.tools?.[1].type).toBe('file_search');
      expect(result.tools?.[2].type).toBe('function');
    });
  });

  describe('function tools', () => {
    it('should prepare function tools', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'function',
            name: 'weather',
            description: 'get weather information',
            inputSchema: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
              required: ['location'],
            },
          },
        ],
      });

      expect(result.tools).toMatchInlineSnapshot(`
        [
          {
            "description": "get weather information",
            "name": "weather",
            "parameters": {
              "properties": {
                "location": {
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
        ]
      `);
    });
  });

  describe('function tools strict mode', () => {
    it('should pass through strict mode when strict is true', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'function',
            name: 'testFunction',
            description: 'A test function',
            inputSchema: { type: 'object', properties: {} },
            strict: true,
          },
        ],
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "description": "A test function",
              "name": "testFunction",
              "parameters": {
                "properties": {},
                "type": "object",
              },
              "strict": true,
              "type": "function",
            },
          ],
        }
      `);
    });

    it('should pass through strict mode when strict is false', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'function',
            name: 'testFunction',
            description: 'A test function',
            inputSchema: { type: 'object', properties: {} },
            strict: false,
          },
        ],
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "description": "A test function",
              "name": "testFunction",
              "parameters": {
                "properties": {},
                "type": "object",
              },
              "strict": false,
              "type": "function",
            },
          ],
        }
      `);
    });

    it('should not include strict when strict is undefined', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'function',
            name: 'testFunction',
            description: 'A test function',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      });

      const tool = result.tools![0];
      expect(tool).not.toHaveProperty('strict');
    });

    it('should pass through strict mode for multiple tools with different strict settings', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'function',
            name: 'strictTool',
            description: 'A strict tool',
            inputSchema: { type: 'object', properties: {} },
            strict: true,
          },
          {
            type: 'function',
            name: 'nonStrictTool',
            description: 'A non-strict tool',
            inputSchema: { type: 'object', properties: {} },
            strict: false,
          },
          {
            type: 'function',
            name: 'defaultTool',
            description: 'A tool without strict setting',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "description": "A strict tool",
              "name": "strictTool",
              "parameters": {
                "properties": {},
                "type": "object",
              },
              "strict": true,
              "type": "function",
            },
            {
              "description": "A non-strict tool",
              "name": "nonStrictTool",
              "parameters": {
                "properties": {},
                "type": "object",
              },
              "strict": false,
              "type": "function",
            },
            {
              "description": "A tool without strict setting",
              "name": "defaultTool",
              "parameters": {
                "properties": {},
                "type": "object",
              },
              "type": "function",
            },
          ],
        }
      `);
    });
  });

  describe('tool choice', () => {
    it('should handle tool choice auto', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'provider',
            id: 'xai.web_search',
            name: 'web_search',
            args: {},
          },
        ],
        toolChoice: { type: 'auto' },
      });

      expect(result.toolChoice).toBe('auto');
    });

    it('should handle tool choice required', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'provider',
            id: 'xai.web_search',
            name: 'web_search',
            args: {},
          },
        ],
        toolChoice: { type: 'required' },
      });

      expect(result.toolChoice).toBe('required');
    });

    it('should handle tool choice none', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'provider',
            id: 'xai.web_search',
            name: 'web_search',
            args: {},
          },
        ],
        toolChoice: { type: 'none' },
      });

      expect(result.toolChoice).toBe('none');
    });

    it('should handle specific tool choice', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'function',
            name: 'weather',
            description: 'get weather',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
        toolChoice: { type: 'tool', toolName: 'weather' },
      });

      expect(result.toolChoice).toEqual({
        type: 'function',
        name: 'weather',
      });
    });

    it('should warn when trying to force server-side tool via toolChoice', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'provider',
            id: 'xai.web_search',
            name: 'web_search',
            args: {},
          },
        ],
        toolChoice: { type: 'tool', toolName: 'web_search' },
      });

      expect(result.toolChoice).toBeUndefined();
      expect(result.toolWarnings).toContainEqual({
        type: 'unsupported',
        feature: 'toolChoice for server-side tool "web_search"',
      });
    });
  });

  describe('multiple tools', () => {
    it('should handle multiple tools including provider-defined and functions', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'function',
            name: 'calculator',
            description: 'calculate numbers',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            type: 'provider',
            id: 'xai.web_search',
            name: 'web_search',
            args: {},
          },
          {
            type: 'provider',
            id: 'xai.x_search',
            name: 'x_search',
            args: {},
          },
        ],
      });

      expect(result.tools).toHaveLength(3);
      expect(result.tools?.[0].type).toBe('function');
      expect(result.tools?.[1].type).toBe('web_search');
      expect(result.tools?.[2].type).toBe('x_search');
    });
  });

  describe('empty tools', () => {
    it('should return undefined for empty tools array', async () => {
      const result = await prepareResponsesTools({
        tools: [],
      });

      expect(result.tools).toBeUndefined();
      expect(result.toolChoice).toBeUndefined();
    });

    it('should return undefined for undefined tools', async () => {
      const result = await prepareResponsesTools({
        tools: undefined,
      });

      expect(result.tools).toBeUndefined();
    });
  });

  describe('unsupported tools', () => {
    it('should warn about unsupported provider-defined tools', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'provider',
            id: 'unsupported.tool',
            name: 'unsupported',
            args: {},
          },
        ],
      });

      expect(result.toolWarnings).toMatchInlineSnapshot(`
        [
          {
            "feature": "provider-defined tool unsupported",
            "type": "unsupported",
          },
        ]
      `);
    });
  });

  describe('mcp', () => {
    it('should prepare mcp tool with required args only', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'provider',
            id: 'xai.mcp',
            name: 'mcp',
            args: {
              serverUrl: 'https://example.com/mcp',
              serverLabel: 'test-server',
            },
          },
        ],
      });

      expect(result.tools).toMatchInlineSnapshot(`
        [
          {
            "allowed_tools": undefined,
            "authorization": undefined,
            "headers": undefined,
            "server_description": undefined,
            "server_label": "test-server",
            "server_url": "https://example.com/mcp",
            "type": "mcp",
          },
        ]
      `);
    });

    it('should prepare mcp tool with all optional args', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'provider',
            id: 'xai.mcp',
            name: 'mcp',
            args: {
              serverUrl: 'https://example.com/mcp',
              serverLabel: 'test-server',
              serverDescription: 'A test MCP server',
              allowedTools: ['tool1', 'tool2'],
              headers: { 'X-Custom': 'value' },
              authorization: 'Bearer token123',
            },
          },
        ],
      });

      expect(result.tools).toMatchInlineSnapshot(`
        [
          {
            "allowed_tools": [
              "tool1",
              "tool2",
            ],
            "authorization": "Bearer token123",
            "headers": {
              "X-Custom": "value",
            },
            "server_description": "A test MCP server",
            "server_label": "test-server",
            "server_url": "https://example.com/mcp",
            "type": "mcp",
          },
        ]
      `);
    });

    it('should warn when trying to force mcp tool via toolChoice', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'provider',
            id: 'xai.mcp',
            name: 'mcp',
            args: {
              serverUrl: 'https://example.com/mcp',
              serverLabel: 'test-server',
            },
          },
        ],
        toolChoice: { type: 'tool', toolName: 'mcp' },
      });

      expect(result.toolChoice).toBeUndefined();
      expect(result.toolWarnings).toContainEqual({
        type: 'unsupported',
        feature: 'toolChoice for server-side tool "mcp"',
      });
    });

    it('should handle multiple tools including mcp', async () => {
      const result = await prepareResponsesTools({
        tools: [
          {
            type: 'provider',
            id: 'xai.web_search',
            name: 'web_search',
            args: {},
          },
          {
            type: 'provider',
            id: 'xai.mcp',
            name: 'mcp',
            args: {
              serverUrl: 'https://example.com/mcp',
              serverLabel: 'test-server',
            },
          },
          {
            type: 'function',
            name: 'calculator',
            description: 'calculate numbers',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      });

      expect(result.tools).toHaveLength(3);
      expect(result.tools?.[0].type).toBe('web_search');
      expect(result.tools?.[1].type).toBe('mcp');
      expect(result.tools?.[2].type).toBe('function');
    });
  });
});
