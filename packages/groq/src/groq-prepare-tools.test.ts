import { describe, it, expect } from 'vitest';
import { prepareTools } from './groq-prepare-tools';

describe('prepareTools', () => {
  it('should return undefined tools and toolChoice when tools are null', () => {
    const result = prepareTools({
      tools: undefined,
      modelId: 'gemma2-9b-it',
    });

    expect(result).toEqual({
      tools: undefined,
      toolChoice: undefined,
      toolWarnings: [],
    });
  });

  it('should return undefined tools and toolChoice when tools are empty', () => {
    const result = prepareTools({
      tools: [],
      modelId: 'gemma2-9b-it',
    });

    expect(result).toEqual({
      tools: undefined,
      toolChoice: undefined,
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
      modelId: 'gemma2-9b-it',
    });

    expect(result.tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'testFunction',
          description: 'A test function',
          parameters: { type: 'object', properties: {} },
        },
      },
    ]);
    expect(result.toolChoice).toBeUndefined();
    expect(result.toolWarnings).toEqual([]);
  });

  it('should add warnings for unsupported provider-defined tools', () => {
    const result = prepareTools({
      tools: [
        {
          type: 'provider',
          id: 'some.unsupported_tool',
          name: 'unsupported_tool',
          args: {},
        },
      ],
      modelId: 'gemma2-9b-it',
    });

    expect(result.tools).toEqual([]);
    expect(result.toolChoice).toBeUndefined();
    expect(result.toolWarnings).toMatchInlineSnapshot(`
      [
        {
          "feature": "provider-defined tool some.unsupported_tool",
          "type": "unsupported",
        },
      ]
    `);
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
      modelId: 'gemma2-9b-it',
    });
    expect(result.toolChoice).toEqual('auto');
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
      modelId: 'gemma2-9b-it',
    });
    expect(result.toolChoice).toEqual('required');
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
      modelId: 'gemma2-9b-it',
    });
    expect(result.toolChoice).toEqual('none');
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
      modelId: 'gemma2-9b-it',
    });
    expect(result.toolChoice).toEqual({
      type: 'function',
      function: { name: 'testFunction' },
    });
  });

  describe('strict mode for function tools', () => {
    it('should pass through strict mode when strict is true', () => {
      const result = prepareTools({
        tools: [
          {
            type: 'function',
            name: 'testFunction',
            description: 'A test function',
            inputSchema: { type: 'object', properties: {} },
            strict: true,
          },
        ],
        modelId: 'gemma2-9b-it',
      });

      expect(result.tools).toEqual([
        {
          type: 'function',
          function: {
            name: 'testFunction',
            description: 'A test function',
            parameters: { type: 'object', properties: {} },
            strict: true,
          },
        },
      ]);
    });

    it('should pass through strict mode when strict is false', () => {
      const result = prepareTools({
        tools: [
          {
            type: 'function',
            name: 'testFunction',
            description: 'A test function',
            inputSchema: { type: 'object', properties: {} },
            strict: false,
          },
        ],
        modelId: 'gemma2-9b-it',
      });

      expect(result.tools).toEqual([
        {
          type: 'function',
          function: {
            name: 'testFunction',
            description: 'A test function',
            parameters: { type: 'object', properties: {} },
            strict: false,
          },
        },
      ]);
    });

    it('should not include strict when strict is undefined', () => {
      const result = prepareTools({
        tools: [
          {
            type: 'function',
            name: 'testFunction',
            description: 'A test function',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
        modelId: 'gemma2-9b-it',
      });

      expect(result.tools).toEqual([
        {
          type: 'function',
          function: {
            name: 'testFunction',
            description: 'A test function',
            parameters: { type: 'object', properties: {} },
          },
        },
      ]);
    });

    it('should pass through strict mode for multiple tools with different strict settings', () => {
      const result = prepareTools({
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
        modelId: 'gemma2-9b-it',
      });

      expect(result.tools).toEqual([
        {
          type: 'function',
          function: {
            name: 'strictTool',
            description: 'A strict tool',
            parameters: { type: 'object', properties: {} },
            strict: true,
          },
        },
        {
          type: 'function',
          function: {
            name: 'nonStrictTool',
            description: 'A non-strict tool',
            parameters: { type: 'object', properties: {} },
            strict: false,
          },
        },
        {
          type: 'function',
          function: {
            name: 'defaultTool',
            description: 'A tool without strict setting',
            parameters: { type: 'object', properties: {} },
          },
        },
      ]);
    });
  });

  describe('browser search tool', () => {
    it('should handle browser search tool with supported model', () => {
      const result = prepareTools({
        tools: [
          {
            type: 'provider',
            id: 'groq.browser_search',
            name: 'browser_search',
            args: {},
          },
        ],
        modelId: 'openai/gpt-oss-120b', // Supported model
      });

      expect(result.tools).toEqual([
        {
          type: 'browser_search',
        },
      ]);
      expect(result.toolWarnings).toEqual([]);
    });

    it('should warn when browser search is used with unsupported model', () => {
      const result = prepareTools({
        tools: [
          {
            type: 'provider',
            id: 'groq.browser_search',
            name: 'browser_search',
            args: {},
          },
        ],
        modelId: 'gemma2-9b-it', // Unsupported model
      });

      expect(result.tools).toEqual([]);
      expect(result.toolWarnings).toMatchInlineSnapshot(`
        [
          {
            "details": "Browser search is only supported on the following models: openai/gpt-oss-20b, openai/gpt-oss-120b. Current model: gemma2-9b-it",
            "feature": "provider-defined tool groq.browser_search",
            "type": "unsupported",
          },
        ]
      `);
    });

    it('should handle mixed tools with model validation', () => {
      const result = prepareTools({
        tools: [
          {
            type: 'function',
            name: 'test-tool',
            description: 'A test tool',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            type: 'provider',
            id: 'groq.browser_search',
            name: 'browser_search',
            args: {},
          },
        ],
        modelId: 'openai/gpt-oss-20b', // Supported model
      });

      expect(result.tools).toEqual([
        {
          type: 'function',
          function: {
            name: 'test-tool',
            description: 'A test tool',
            parameters: { type: 'object', properties: {} },
          },
        },
        {
          type: 'browser_search',
        },
      ]);
      expect(result.toolWarnings).toEqual([]);
    });

    it('should validate all browser search supported models', () => {
      const supportedModels = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'];

      supportedModels.forEach(modelId => {
        const result = prepareTools({
          tools: [
            {
              type: 'provider',
              id: 'groq.browser_search',
              name: 'browser_search',
              args: {},
            },
          ],
          modelId: modelId as any,
        });

        expect(result.tools).toEqual([{ type: 'browser_search' }]);
        expect(result.toolWarnings).toEqual([]);
      });
    });

    it('should handle browser search with tool choice', () => {
      const result = prepareTools({
        tools: [
          {
            type: 'provider',
            id: 'groq.browser_search',
            name: 'browser_search',
            args: {},
          },
        ],
        toolChoice: { type: 'required' },
        modelId: 'openai/gpt-oss-120b',
      });

      expect(result.tools).toEqual([{ type: 'browser_search' }]);
      expect(result.toolChoice).toEqual('required');
      expect(result.toolWarnings).toEqual([]);
    });
  });
});
