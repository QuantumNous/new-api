import { describe, it, expect } from 'vitest';
import { prepareTools } from './anthropic-prepare-tools';
import { CacheControlValidator } from './get-cache-control';
import { webFetch_20260209OutputSchema } from './tool/web-fetch-20260209';
import { webFetch_20250910OutputSchema } from './tool/web-fetch-20250910';
import { webSearch_20260209OutputSchema } from './tool/web-search_20260209';
import { webSearch_20250305OutputSchema } from './tool/web-search_20250305';
import { anthropicChunkSchema, anthropicResponseSchema } from './anthropic-api';

describe('prepareTools', () => {
  it('should return undefined tools and tool_choice when tools are null', async () => {
    const result = await prepareTools({
      tools: undefined,
      toolChoice: undefined,
      supportsStructuredOutput: true,
      supportsStrictTools: true,
    });
    expect(result).toEqual({
      tools: undefined,
      tool_choice: undefined,
      toolWarnings: [],
      betas: new Set(),
    });
  });

  it('should return undefined tools and tool_choice when tools are empty', async () => {
    const result = await prepareTools({
      tools: [],
      toolChoice: undefined,
      supportsStructuredOutput: true,
      supportsStrictTools: true,
    });
    expect(result).toEqual({
      tools: undefined,
      tool_choice: undefined,
      toolWarnings: [],
      betas: new Set(),
    });
  });

  it('should correctly prepare function tools', async () => {
    const result = await prepareTools({
      tools: [
        {
          type: 'function',
          name: 'testFunction',
          description: 'A test function',
          inputSchema: { type: 'object', properties: {} },
          providerOptions: {
            anthropic: { eagerInputStreaming: true },
          },
        },
      ],
      toolChoice: undefined,
      supportsStructuredOutput: true,
      supportsStrictTools: true,
    });
    expect(result.tools).toEqual([
      {
        cache_control: undefined,
        name: 'testFunction',
        description: 'A test function',
        input_schema: { type: 'object', properties: {} },
        eager_input_streaming: true,
      },
    ]);
    expect(result.toolChoice).toBeUndefined();
    expect(result.toolWarnings).toEqual([]);
  });

  it('should correctly preserve tool input examples', async () => {
    const result = await prepareTools({
      tools: [
        {
          type: 'function',
          name: 'tool_with_examples',
          description: 'tool with examples',
          inputSchema: {
            type: 'object',
            properties: { a: { type: 'number' } },
          },
          inputExamples: [{ input: { a: 1 } }, { input: { a: 2 } }],
        },
      ],
      toolChoice: undefined,
      supportsStructuredOutput: true,
      supportsStrictTools: true,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "betas": Set {
          "structured-outputs-2025-11-13",
          "advanced-tool-use-2025-11-20",
        },
        "toolChoice": undefined,
        "toolWarnings": [],
        "tools": [
          {
            "cache_control": undefined,
            "description": "tool with examples",
            "input_examples": [
              {
                "a": 1,
              },
              {
                "a": 2,
              },
            ],
            "input_schema": {
              "properties": {
                "a": {
                  "type": "number",
                },
              },
              "type": "object",
            },
            "name": "tool_with_examples",
          },
        ],
      }
    `);
  });

  describe('strict mode for function tools', () => {
    it('should include strict and structured-outputs beta when supportsStructuredOutput is true and strict is true', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'function',
            name: 'testFunction',
            description: 'A test function',
            inputSchema: { type: 'object', properties: {} },
            strict: true,
          },
        ],
        toolChoice: undefined,
        supportsStructuredOutput: true,
        supportsStrictTools: true,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {
            "structured-outputs-2025-11-13",
          },
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "cache_control": undefined,
              "description": "A test function",
              "input_schema": {
                "properties": {},
                "type": "object",
              },
              "name": "testFunction",
              "strict": true,
            },
          ],
        }
      `);
    });

    it('should include beta but not strict property when strict is undefined and supportsStructuredOutput is true', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'function',
            name: 'testFunction',
            description: 'A test function',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
        toolChoice: undefined,
        supportsStructuredOutput: true,
        supportsStrictTools: true,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {
            "structured-outputs-2025-11-13",
          },
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "cache_control": undefined,
              "description": "A test function",
              "input_schema": {
                "properties": {},
                "type": "object",
              },
              "name": "testFunction",
            },
          ],
        }
      `);
    });

    it('should not include strict, emit warning, and not add beta when both supportsStructuredOutput and supportsStrictTools are false', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'function',
            name: 'testFunction',
            description: 'A test function',
            inputSchema: { type: 'object', properties: {} },
            strict: true,
          },
        ],
        toolChoice: undefined,
        supportsStructuredOutput: false,
        supportsStrictTools: false,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {},
          "toolChoice": undefined,
          "toolWarnings": [
            {
              "details": "Tool 'testFunction' has strict: true, but strict mode is not supported by this provider. The strict property will be ignored.",
              "feature": "strict",
              "type": "unsupported",
            },
          ],
          "tools": [
            {
              "cache_control": undefined,
              "description": "A test function",
              "input_schema": {
                "properties": {},
                "type": "object",
              },
              "name": "testFunction",
            },
          ],
        }
      `);
    });

    it('should include strict but not beta when supportsStructuredOutput is false but supportsStrictTools is true', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'function',
            name: 'testFunction',
            description: 'A test function',
            inputSchema: { type: 'object', properties: {} },
            strict: true,
          },
        ],
        toolChoice: undefined,
        supportsStructuredOutput: false,
        supportsStrictTools: true,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {},
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "cache_control": undefined,
              "description": "A test function",
              "input_schema": {
                "properties": {},
                "type": "object",
              },
              "name": "testFunction",
              "strict": true,
            },
          ],
        }
      `);
    });

    it('should include beta when strict is false and supportsStructuredOutput is true', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'function',
            name: 'testFunction',
            description: 'A test function',
            inputSchema: { type: 'object', properties: {} },
            strict: false,
          },
        ],
        toolChoice: undefined,
        supportsStructuredOutput: true,
        supportsStrictTools: true,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {
            "structured-outputs-2025-11-13",
          },
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "cache_control": undefined,
              "description": "A test function",
              "input_schema": {
                "properties": {},
                "type": "object",
              },
              "name": "testFunction",
              "strict": false,
            },
          ],
        }
      `);
    });
  });

  describe('provider-defined tools', () => {
    describe('computer_20241022', () => {
      it('should correctly prepare computer_20241022 tool', async () => {
        const result = await prepareTools({
          tools: [
            {
              type: 'provider',
              id: 'anthropic.computer_20241022',
              name: 'computer',
              args: {
                displayWidthPx: 800,
                displayHeightPx: 600,
                displayNumber: 1,
              },
            },
          ],
          toolChoice: undefined,
          supportsStructuredOutput: true,
          supportsStrictTools: true,
        });

        expect(result).toMatchInlineSnapshot(`
          {
            "betas": Set {
              "computer-use-2024-10-22",
            },
            "toolChoice": undefined,
            "toolWarnings": [],
            "tools": [
              {
                "cache_control": undefined,
                "display_height_px": 600,
                "display_number": 1,
                "display_width_px": 800,
                "name": "computer",
                "type": "computer_20241022",
              },
            ],
          }
        `);
      });
    });

    describe('computer_20250124', () => {
      it('should correctly prepare computer_20250124 tool', async () => {
        const result = await prepareTools({
          tools: [
            {
              type: 'provider',
              id: 'anthropic.computer_20250124',
              name: 'computer',
              args: {
                displayWidthPx: 1024,
                displayHeightPx: 768,
                displayNumber: 1,
              },
            },
          ],
          toolChoice: undefined,
          supportsStructuredOutput: true,
          supportsStrictTools: true,
        });

        expect(result).toMatchInlineSnapshot(`
          {
            "betas": Set {
              "computer-use-2025-01-24",
            },
            "toolChoice": undefined,
            "toolWarnings": [],
            "tools": [
              {
                "cache_control": undefined,
                "display_height_px": 768,
                "display_number": 1,
                "display_width_px": 1024,
                "name": "computer",
                "type": "computer_20250124",
              },
            ],
          }
        `);
      });
    });

    describe('computer_20251124', () => {
      it('should correctly prepare computer_20251124 tool', async () => {
        const result = await prepareTools({
          tools: [
            {
              type: 'provider',
              id: 'anthropic.computer_20251124',
              name: 'computer',
              args: {
                displayWidthPx: 1024,
                displayHeightPx: 768,
                displayNumber: 1,
              },
            },
          ],
          toolChoice: undefined,
          supportsStructuredOutput: true,
          supportsStrictTools: true,
        });

        expect(result).toMatchInlineSnapshot(`
          {
            "betas": Set {
              "computer-use-2025-11-24",
            },
            "toolChoice": undefined,
            "toolWarnings": [],
            "tools": [
              {
                "cache_control": undefined,
                "display_height_px": 768,
                "display_number": 1,
                "display_width_px": 1024,
                "enable_zoom": undefined,
                "name": "computer",
                "type": "computer_20251124",
              },
            ],
          }
        `);
      });

      it('should correctly prepare computer_20251124 tool with enableZoom', async () => {
        const result = await prepareTools({
          tools: [
            {
              type: 'provider',
              id: 'anthropic.computer_20251124',
              name: 'computer',
              args: {
                displayWidthPx: 1024,
                displayHeightPx: 768,
                displayNumber: 1,
                enableZoom: true,
              },
            },
          ],
          toolChoice: undefined,
          supportsStructuredOutput: true,
          supportsStrictTools: true,
        });

        expect(result).toMatchInlineSnapshot(`
          {
            "betas": Set {
              "computer-use-2025-11-24",
            },
            "toolChoice": undefined,
            "toolWarnings": [],
            "tools": [
              {
                "cache_control": undefined,
                "display_height_px": 768,
                "display_number": 1,
                "display_width_px": 1024,
                "enable_zoom": true,
                "name": "computer",
                "type": "computer_20251124",
              },
            ],
          }
        `);
      });

      it('should correctly prepare computer_20251124 tool with enableZoom false', async () => {
        const result = await prepareTools({
          tools: [
            {
              type: 'provider',
              id: 'anthropic.computer_20251124',
              name: 'computer',
              args: {
                displayWidthPx: 1024,
                displayHeightPx: 768,
                displayNumber: 1,
                enableZoom: false,
              },
            },
          ],
          toolChoice: undefined,
          supportsStructuredOutput: true,
          supportsStrictTools: true,
        });

        expect(result).toMatchInlineSnapshot(`
          {
            "betas": Set {
              "computer-use-2025-11-24",
            },
            "toolChoice": undefined,
            "toolWarnings": [],
            "tools": [
              {
                "cache_control": undefined,
                "display_height_px": 768,
                "display_number": 1,
                "display_width_px": 1024,
                "enable_zoom": false,
                "name": "computer",
                "type": "computer_20251124",
              },
            ],
          }
        `);
      });
    });

    describe('text_editor_20241022', () => {
      it('should correctly prepare text_editor_20241022 tool', async () => {
        const result = await prepareTools({
          tools: [
            {
              type: 'provider',
              id: 'anthropic.text_editor_20241022',
              name: 'text_editor',
              args: {},
            },
          ],
          toolChoice: undefined,
          supportsStructuredOutput: true,
          supportsStrictTools: true,
        });
        expect(result).toMatchInlineSnapshot(`
          {
            "betas": Set {
              "computer-use-2024-10-22",
            },
            "toolChoice": undefined,
            "toolWarnings": [],
            "tools": [
              {
                "cache_control": undefined,
                "name": "str_replace_editor",
                "type": "text_editor_20241022",
              },
            ],
          }
        `);
      });
    });

    it('should correctly prepare bash_20241022 tool', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'provider',
            id: 'anthropic.bash_20241022',
            name: 'bash',
            args: {},
          },
        ],
        toolChoice: undefined,
        supportsStructuredOutput: true,
        supportsStrictTools: true,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {
            "computer-use-2024-10-22",
          },
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "cache_control": undefined,
              "name": "bash",
              "type": "bash_20241022",
            },
          ],
        }
      `);
    });

    it('should correctly prepare text_editor_20250728 with max_characters', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'provider',
            id: 'anthropic.text_editor_20250728',
            name: 'str_replace_based_edit_tool',
            args: { maxCharacters: 10000 },
          },
        ],
        toolChoice: undefined,
        supportsStructuredOutput: true,
        supportsStrictTools: true,
      });
      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {},
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "cache_control": undefined,
              "max_characters": 10000,
              "name": "str_replace_based_edit_tool",
              "type": "text_editor_20250728",
            },
          ],
        }
      `);
    });

    it('should correctly prepare text_editor_20250728 without max_characters', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'provider',
            id: 'anthropic.text_editor_20250728',
            name: 'str_replace_based_edit_tool',
            args: {},
          },
        ],
        toolChoice: undefined,
        supportsStructuredOutput: true,
        supportsStrictTools: true,
      });
      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {},
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "cache_control": undefined,
              "max_characters": undefined,
              "name": "str_replace_based_edit_tool",
              "type": "text_editor_20250728",
            },
          ],
        }
      `);
    });

    it('should correctly prepare web_search_20250305', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'provider',
            id: 'anthropic.web_search_20250305',
            name: 'web_search',
            args: {
              maxUses: 10,
              allowedDomains: ['https://www.google.com'],
              userLocation: { type: 'approximate', city: 'New York' },
            },
          },
        ],
        toolChoice: undefined,
        supportsStructuredOutput: true,
        supportsStrictTools: true,
      });
      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {},
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "allowed_domains": [
                "https://www.google.com",
              ],
              "blocked_domains": undefined,
              "cache_control": undefined,
              "max_uses": 10,
              "name": "web_search",
              "type": "web_search_20250305",
              "user_location": {
                "city": "New York",
                "type": "approximate",
              },
            },
          ],
        }
      `);
    });

    it('should correctly prepare web_search_20260209', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'provider',
            id: 'anthropic.web_search_20260209',
            name: 'web_search',
            args: {
              maxUses: 10,
              allowedDomains: ['https://www.google.com'],
              userLocation: { type: 'approximate', city: 'New York' },
            },
          },
        ],
        toolChoice: undefined,
        supportsStructuredOutput: true,
        supportsStrictTools: true,
      });
      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {
            "code-execution-web-tools-2026-02-09",
          },
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "allowed_domains": [
                "https://www.google.com",
              ],
              "blocked_domains": undefined,
              "cache_control": undefined,
              "max_uses": 10,
              "name": "web_search",
              "type": "web_search_20260209",
              "user_location": {
                "city": "New York",
                "type": "approximate",
              },
            },
          ],
        }
      `);
    });

    it('should correctly prepare web_fetch_20250910', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'provider',
            id: 'anthropic.web_fetch_20250910',
            name: 'web_fetch',
            args: {
              maxUses: 10,
              allowedDomains: ['https://www.google.com'],
              citations: { enabled: true },
              maxContentTokens: 1000,
            },
          },
        ],
        toolChoice: undefined,
        supportsStructuredOutput: true,
        supportsStrictTools: true,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {
            "web-fetch-2025-09-10",
          },
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "allowed_domains": [
                "https://www.google.com",
              ],
              "blocked_domains": undefined,
              "cache_control": undefined,
              "citations": {
                "enabled": true,
              },
              "max_content_tokens": 1000,
              "max_uses": 10,
              "name": "web_fetch",
              "type": "web_fetch_20250910",
            },
          ],
        }
      `);
    });

    it('should correctly prepare web_fetch_20260209', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'provider',
            id: 'anthropic.web_fetch_20260209',
            name: 'web_fetch',
            args: {
              maxUses: 10,
              allowedDomains: ['https://www.google.com'],
              citations: { enabled: true },
              maxContentTokens: 1000,
            },
          },
        ],
        toolChoice: undefined,
        supportsStructuredOutput: true,
        supportsStrictTools: true,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {
            "code-execution-web-tools-2026-02-09",
          },
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "allowed_domains": [
                "https://www.google.com",
              ],
              "blocked_domains": undefined,
              "cache_control": undefined,
              "citations": {
                "enabled": true,
              },
              "max_content_tokens": 1000,
              "max_uses": 10,
              "name": "web_fetch",
              "type": "web_fetch_20260209",
            },
          ],
        }
      `);
    });

    it('should correctly prepare tool_search_regex_20251119', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'provider',
            id: 'anthropic.tool_search_regex_20251119',
            name: 'tool_search',
            args: {},
          },
        ],
        toolChoice: undefined,
        supportsStructuredOutput: true,
        supportsStrictTools: true,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {},
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "name": "tool_search_tool_regex",
              "type": "tool_search_tool_regex_20251119",
            },
          ],
        }
      `);
    });

    it('should correctly prepare code_execution_20260120 without beta header', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'provider',
            id: 'anthropic.code_execution_20260120',
            name: 'code_execution',
            args: {},
          },
        ],
        toolChoice: undefined,
        supportsStructuredOutput: true,
        supportsStrictTools: true,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {},
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "name": "code_execution",
              "type": "code_execution_20260120",
            },
          ],
        }
      `);
    });

    it('should correctly prepare tool_search_bm25_20251119', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'provider',
            id: 'anthropic.tool_search_bm25_20251119',
            name: 'tool_search',
            args: {},
          },
        ],
        toolChoice: undefined,
        supportsStructuredOutput: true,
        supportsStrictTools: true,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {},
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "name": "tool_search_tool_bm25",
              "type": "tool_search_tool_bm25_20251119",
            },
          ],
        }
      `);
    });

    it('should correctly prepare advisor_20260301 with only the required model', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'provider',
            id: 'anthropic.advisor_20260301',
            name: 'advisor',
            args: {
              model: 'claude-opus-4-7',
            },
          },
        ],
        toolChoice: undefined,
        supportsStructuredOutput: true,
        supportsStrictTools: true,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {
            "advisor-tool-2026-03-01",
          },
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "model": "claude-opus-4-7",
              "name": "advisor",
              "type": "advisor_20260301",
            },
          ],
        }
      `);
    });

    it('should correctly prepare advisor_20260301 with all optional args', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'provider',
            id: 'anthropic.advisor_20260301',
            name: 'advisor',
            args: {
              model: 'claude-opus-4-7',
              maxUses: 5,
              caching: { type: 'ephemeral', ttl: '1h' },
            },
          },
        ],
        toolChoice: undefined,
        supportsStructuredOutput: true,
        supportsStrictTools: true,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {
            "advisor-tool-2026-03-01",
          },
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "caching": {
                "ttl": "1h",
                "type": "ephemeral",
              },
              "max_uses": 5,
              "model": "claude-opus-4-7",
              "name": "advisor",
              "type": "advisor_20260301",
            },
          ],
        }
      `);
    });
  });

  describe('deferLoading for function tools', () => {
    it('should include defer_loading when set to true', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'function',
            name: 'testFunction',
            description: 'A test function',
            inputSchema: { type: 'object', properties: {} },
            providerOptions: {
              anthropic: { deferLoading: true },
            },
          },
        ],
        toolChoice: undefined,
        supportsStructuredOutput: true,
        supportsStrictTools: true,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {
            "structured-outputs-2025-11-13",
          },
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "cache_control": undefined,
              "defer_loading": true,
              "description": "A test function",
              "input_schema": {
                "properties": {},
                "type": "object",
              },
              "name": "testFunction",
            },
          ],
        }
      `);
    });

    it('should include defer_loading when set to false', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'function',
            name: 'testFunction',
            description: 'A test function',
            inputSchema: { type: 'object', properties: {} },
            providerOptions: {
              anthropic: { deferLoading: false },
            },
          },
        ],
        toolChoice: undefined,
        supportsStructuredOutput: true,
        supportsStrictTools: true,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {
            "structured-outputs-2025-11-13",
          },
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "cache_control": undefined,
              "defer_loading": false,
              "description": "A test function",
              "input_schema": {
                "properties": {},
                "type": "object",
              },
              "name": "testFunction",
            },
          ],
        }
      `);
    });

    it('should not include defer_loading when not specified', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'function',
            name: 'testFunction',
            description: 'A test function',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
        toolChoice: undefined,
        supportsStructuredOutput: true,
        supportsStrictTools: true,
      });

      expect(result.tools?.[0]).not.toHaveProperty('defer_loading');
    });
  });

  describe('allowedCallers for function tools (programmatic tool calling)', () => {
    it('should include allowed_callers and advanced-tool-use beta when allowedCallers is set', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'function',
            name: 'query_database',
            description: 'Query a database',
            inputSchema: {
              type: 'object',
              properties: { sql: { type: 'string' } },
            },
            providerOptions: {
              anthropic: {
                allowedCallers: ['code_execution_20250825'],
              },
            },
          },
        ],
        toolChoice: undefined,
        supportsStructuredOutput: true,
        supportsStrictTools: true,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {
            "structured-outputs-2025-11-13",
            "advanced-tool-use-2025-11-20",
          },
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "allowed_callers": [
                "code_execution_20250825",
              ],
              "cache_control": undefined,
              "description": "Query a database",
              "input_schema": {
                "properties": {
                  "sql": {
                    "type": "string",
                  },
                },
                "type": "object",
              },
              "name": "query_database",
            },
          ],
        }
      `);
    });

    it('should not include allowed_callers when not specified', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'function',
            name: 'testFunction',
            description: 'A test function',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
        toolChoice: undefined,
        supportsStructuredOutput: true,
        supportsStrictTools: true,
      });

      expect(result.tools?.[0]).not.toHaveProperty('allowed_callers');
    });

    it('should include both deferLoading and allowedCallers when both are set', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'function',
            name: 'query_database',
            description: 'Query a database',
            inputSchema: {
              type: 'object',
              properties: { sql: { type: 'string' } },
            },
            providerOptions: {
              anthropic: {
                deferLoading: true,
                allowedCallers: ['code_execution_20250825'],
              },
            },
          },
        ],
        toolChoice: undefined,
        supportsStructuredOutput: true,
        supportsStrictTools: true,
      });

      expect(result.tools?.[0]).toHaveProperty('defer_loading', true);
      expect(result.tools?.[0]).toHaveProperty('allowed_callers', [
        'code_execution_20250825',
      ]);
      expect(result.betas).toContain('advanced-tool-use-2025-11-20');
    });

    it('should include allowed_callers with code_execution_20260120', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'function',
            name: 'query_database',
            description: 'Query a database',
            inputSchema: {
              type: 'object',
              properties: { sql: { type: 'string' } },
            },
            providerOptions: {
              anthropic: {
                allowedCallers: ['code_execution_20260120'],
              },
            },
          },
        ],
        toolChoice: undefined,
        supportsStructuredOutput: true,
        supportsStrictTools: true,
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "betas": Set {
            "structured-outputs-2025-11-13",
            "advanced-tool-use-2025-11-20",
          },
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "allowed_callers": [
                "code_execution_20260120",
              ],
              "cache_control": undefined,
              "description": "Query a database",
              "input_schema": {
                "properties": {
                  "sql": {
                    "type": "string",
                  },
                },
                "type": "object",
              },
              "name": "query_database",
            },
          ],
        }
      `);
    });
  });

  it('should add warnings for unsupported tools', async () => {
    const result = await prepareTools({
      tools: [
        {
          type: 'provider',
          id: 'unsupported.tool',
          name: 'unsupported_tool',
          args: {},
        },
      ],
      toolChoice: undefined,
      supportsStructuredOutput: true,
      supportsStrictTools: true,
    });

    expect(result.tools).toEqual([]);
    expect(result.toolChoice).toBeUndefined();
    expect(result.toolWarnings).toMatchInlineSnapshot(`
      [
        {
          "feature": "provider-defined tool unsupported.tool",
          "type": "unsupported",
        },
      ]
    `);
  });

  it('should handle tool choice "auto"', async () => {
    const result = await prepareTools({
      tools: [
        {
          type: 'function',
          name: 'testFunction',
          description: 'Test',
          inputSchema: {},
        },
      ],
      toolChoice: { type: 'auto' },
      supportsStructuredOutput: true,
      supportsStrictTools: true,
    });

    expect(result.toolChoice).toEqual({ type: 'auto' });
  });

  it('should handle tool choice "required"', async () => {
    const result = await prepareTools({
      tools: [
        {
          type: 'function',
          name: 'testFunction',
          description: 'Test',
          inputSchema: {},
        },
      ],
      toolChoice: { type: 'required' },
      supportsStructuredOutput: true,
      supportsStrictTools: true,
    });

    expect(result.toolChoice).toEqual({ type: 'any' });
  });

  it('should handle tool choice "none"', async () => {
    const result = await prepareTools({
      tools: [
        {
          type: 'function',
          name: 'testFunction',
          description: 'Test',
          inputSchema: {},
        },
      ],
      toolChoice: { type: 'none' },
      supportsStructuredOutput: true,
      supportsStrictTools: true,
    });
    expect(result.tools).toBeUndefined();
    expect(result.toolChoice).toBeUndefined();
  });

  it('should handle tool choice "tool"', async () => {
    const result = await prepareTools({
      tools: [
        {
          type: 'function',
          name: 'testFunction',
          description: 'Test',
          inputSchema: {},
        },
      ],
      toolChoice: { type: 'tool', toolName: 'testFunction' },
      supportsStructuredOutput: true,
      supportsStrictTools: true,
    });
    expect(result.toolChoice).toEqual({ type: 'tool', name: 'testFunction' });
  });

  it('should set cache control', async () => {
    const result = await prepareTools({
      tools: [
        {
          type: 'function',
          name: 'testFunction',
          description: 'Test',
          inputSchema: {},
          providerOptions: {
            anthropic: {
              cacheControl: { type: 'ephemeral' },
            },
          },
        },
      ],
      toolChoice: undefined,
      supportsStructuredOutput: true,
      supportsStrictTools: true,
    });

    expect(result.tools).toMatchInlineSnapshot(`
      [
        {
          "cache_control": {
            "type": "ephemeral",
          },
          "description": "Test",
          "input_schema": {},
          "name": "testFunction",
        },
      ]
    `);
  });

  it('should limit cache breakpoints to 4', async () => {
    const cacheControlValidator = new CacheControlValidator();
    const result = await prepareTools({
      tools: [
        {
          type: 'function',
          name: 'tool1',
          description: 'Test 1',
          inputSchema: {},
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' } },
          },
        },
        {
          type: 'function',
          name: 'tool2',
          description: 'Test 2',
          inputSchema: {},
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' } },
          },
        },
        {
          type: 'function',
          name: 'tool3',
          description: 'Test 3',
          inputSchema: {},
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' } },
          },
        },
        {
          type: 'function',
          name: 'tool4',
          description: 'Test 4',
          inputSchema: {},
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' } },
          },
        },
        {
          type: 'function',
          name: 'tool5',
          description: 'Test 5 (should be rejected)',
          inputSchema: {},
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' } },
          },
        },
      ],
      toolChoice: undefined,
      supportsStructuredOutput: true,
      supportsStrictTools: true,
      cacheControlValidator,
    });

    // First 4 should have cache_control
    expect(result.tools?.[0]).toHaveProperty('cache_control', {
      type: 'ephemeral',
    });
    expect(result.tools?.[1]).toHaveProperty('cache_control', {
      type: 'ephemeral',
    });
    expect(result.tools?.[2]).toHaveProperty('cache_control', {
      type: 'ephemeral',
    });
    expect(result.tools?.[3]).toHaveProperty('cache_control', {
      type: 'ephemeral',
    });

    // 5th should be rejected (cache_control should be undefined)
    expect(result.tools?.[4]).toHaveProperty('cache_control', undefined);

    expect(cacheControlValidator.getWarnings()).toMatchInlineSnapshot(`
      [
        {
          "details": "Maximum 4 cache breakpoints exceeded (found 5). This breakpoint will be ignored.",
          "feature": "cacheControl breakpoint limit",
          "type": "unsupported",
        },
      ]
    `);
  });
});

describe('webFetch_20250910OutputSchema', () => {
  it('should not fail validation when title is null', async () => {
    const problematicResponse = {
      type: 'web_fetch_result',
      url: 'https://test.com',
      retrievedAt: '2025-12-08T20:46:31.114158',
      content: {
        type: 'document',
        title: null,
        source: {
          type: 'text',
          mediaType: 'text/plain',
          data: '',
        },
      },
    };

    const schema = webFetch_20250910OutputSchema();

    const result = await schema.validate!(problematicResponse);

    expect(result.success).toBe(true);
  });

  it('should accept valid response with string title', async () => {
    const validResponse = {
      type: 'web_fetch_result',
      url: 'https://test.com',
      retrievedAt: '2025-12-08T20:46:31.114158',
      content: {
        type: 'document',
        title: 'Example Title',
        source: {
          type: 'text',
          mediaType: 'text/plain',
          data: 'Some content',
        },
      },
    };

    const schema = webFetch_20250910OutputSchema();
    const result = await schema.validate!(validResponse);

    expect(result.success).toBe(true);
  });
});

describe('webFetch_20260209OutputSchema', () => {
  it('should not fail validation when title is null', async () => {
    const problematicResponse = {
      type: 'web_fetch_result',
      url: 'https://test.com',
      retrievedAt: '2025-12-08T20:46:31.114158',
      content: {
        type: 'document',
        title: null,
        source: {
          type: 'text',
          mediaType: 'text/plain',
          data: '',
        },
      },
    };

    const schema = webFetch_20260209OutputSchema();

    const result = await schema.validate!(problematicResponse);

    expect(result.success).toBe(true);
  });
});

describe('webSearch_20250305OutputSchema', () => {
  it('should not fail validation when title is null', async () => {
    const problematicResponse = [
      {
        url: 'https://test.com',
        title: null,
        pageAge: 'April 30, 2025',
        encryptedContent:
          'EqgfCioIARgBIiQ3YTAwMjY1Mi1mZjM5LTQ1NGUtODgxNC1kNjNjNTk1ZWI3Y...',
        type: 'web_search_result',
      },
    ];

    const schema = webSearch_20250305OutputSchema();

    const result = await schema.validate!(problematicResponse);

    expect(result.success).toBe(true);
  });

  it('should accept valid response with string title', async () => {
    const validResponse = [
      {
        url: 'https://test.com',
        title: 'Test title',
        pageAge: 'April 30, 2025',
        encryptedContent:
          'EqgfCioIARgBIiQ3YTAwMjY1Mi1mZjM5LTQ1NGUtODgxNC1kNjNjNTk1ZWI3Y...',
        type: 'web_search_result',
      },
    ];

    const schema = webSearch_20250305OutputSchema();
    const result = await schema.validate!(validResponse);

    expect(result.success).toBe(true);
  });
});

describe('webSearch_20260209OutputSchema', () => {
  it('should not fail validation when title is null', async () => {
    const problematicResponse = [
      {
        url: 'https://test.com',
        title: null,
        pageAge: 'April 30, 2025',
        encryptedContent:
          'EqgfCioIARgBIiQ3YTAwMjY1Mi1mZjM5LTQ1NGUtODgxNC1kNjNjNTk1ZWI3Y...',
        type: 'web_search_result',
      },
    ];

    const schema = webSearch_20260209OutputSchema();

    const result = await schema.validate!(problematicResponse);

    expect(result.success).toBe(true);
  });
});

describe('anthropicResponseSchema - web_fetch_tool_result', () => {
  it('should accept PDF response with base64 source', async () => {
    const pdfResponse = {
      type: 'message',
      id: '123',
      model: 'claude-3-5-sonnet-20241022',
      content: [
        {
          type: 'web_fetch_tool_result',
          tool_use_id: 'srvtoolu_01234567890abcdef',
          content: {
            type: 'web_fetch_result',
            url: 'https://test.com',
            retrieved_at: '2025-12-08T20:46:31.114158',
            content: {
              type: 'document',
              title: 'Example Title',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: 'JVBERi0xLjcNJeLjz9MNC',
              },
            },
          },
        },
      ],
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 100,
        output_tokens: 50,
      },
    };

    const schema = anthropicResponseSchema();
    const result = await schema.validate!(pdfResponse);

    expect(result.success).toBe(true);
  });

  it('should accept text source in response', async () => {
    const textResponse = {
      type: 'message',
      id: '123',
      model: 'claude-3-5-sonnet-20241022',
      content: [
        {
          type: 'web_fetch_tool_result',
          tool_use_id: 'srvtoolu_01234567890abcdef',
          content: {
            type: 'web_fetch_result',
            url: 'https://test.com',
            retrieved_at: '2025-12-08T20:46:31.114158',
            content: {
              type: 'document',
              title: 'Example Title',
              source: {
                type: 'text',
                media_type: 'text/plain',
                data: 'content',
              },
            },
          },
        },
      ],
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 100,
        output_tokens: 50,
      },
    };

    const schema = anthropicResponseSchema();
    const result = await schema.validate!(textResponse);

    expect(result.success).toBe(true);
  });
});

describe('anthropicChunkSchema - web_fetch_tool_result', () => {
  it('should accept base64 PDF source in streaming response', async () => {
    const pdfChunk = {
      type: 'content_block_start',
      index: 10,
      content_block: {
        type: 'web_fetch_tool_result',
        tool_use_id: 'srvtoolu_01234567890abcdef',
        content: {
          type: 'web_fetch_result',
          url: 'https://test.com',
          retrieved_at: '2025-12-08T20:46:31.114158',
          content: {
            type: 'document',
            title: null,
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: 'JVBERi0xLjcNJeLjz9MNC',
            },
          },
        },
      },
    };

    const schema = anthropicChunkSchema();
    const result = await schema.validate!(pdfChunk);

    expect(result.success).toBe(true);
  });

  it('should accept text source in streaming response', async () => {
    const pdfChunk = {
      type: 'content_block_start',
      index: 10,
      content_block: {
        type: 'web_fetch_tool_result',
        tool_use_id: 'srvtoolu_01234567890abcdef',
        content: {
          type: 'web_fetch_result',
          url: 'https://test.com',
          retrieved_at: '2025-12-08T20:46:31.114158',
          content: {
            type: 'document',
            title: null,
            source: {
              type: 'text',
              media_type: 'text/plain',
              data: 'content',
            },
          },
        },
      },
    };

    const schema = anthropicChunkSchema();
    const result = await schema.validate!(pdfChunk);

    expect(result.success).toBe(true);
  });
});
