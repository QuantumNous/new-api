import type * as AnthropicInternal from '@ai-sdk/anthropic/internal';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prepareTools } from './amazon-bedrock-prepare-tools';

vi.mock('@ai-sdk/anthropic/internal', async importOriginal => {
  const original = await importOriginal<typeof AnthropicInternal>();
  return {
    ...original,
    prepareTools: vi.fn().mockResolvedValue({
      toolChoice: undefined,
      toolWarnings: [],
      betas: new Set<string>(),
    }),
  };
});

const NON_ANTHROPIC_MODEL = 'meta.llama3-70b-instruct-v1:0';
const ANTHROPIC_MODEL = 'anthropic.claude-sonnet-4-5-20250929-v1:0';

describe('prepareTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty toolConfig when tools are undefined', async () => {
    const result = await prepareTools({
      tools: undefined,
      modelId: ANTHROPIC_MODEL,
    });

    expect(result).toEqual({
      toolConfig: {},
      additionalTools: undefined,
      betas: new Set(),
      toolWarnings: [],
    });
  });

  it('should return empty toolConfig when tools are empty', async () => {
    const result = await prepareTools({
      tools: [],
      modelId: ANTHROPIC_MODEL,
    });

    expect(result).toEqual({
      toolConfig: {},
      additionalTools: undefined,
      betas: new Set(),
      toolWarnings: [],
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
        },
      ],
      modelId: ANTHROPIC_MODEL,
    });

    expect(result.toolConfig.tools).toEqual([
      {
        toolSpec: {
          name: 'testFunction',
          description: 'A test function',
          inputSchema: {
            json: { type: 'object', properties: {} },
          },
        },
      },
    ]);
    expect(result.toolWarnings).toEqual([]);
  });

  describe('tool description handling', () => {
    it('should exclude description when it is empty string', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'function',
            name: 'testFunction',
            description: '',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
        modelId: ANTHROPIC_MODEL,
      });

      const toolSpec = (result.toolConfig.tools![0] as any).toolSpec;
      expect(toolSpec).not.toHaveProperty('description');
    });

    it('should exclude description when it is whitespace-only', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'function',
            name: 'testFunction',
            description: '   ',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
        modelId: ANTHROPIC_MODEL,
      });

      const toolSpec = (result.toolConfig.tools![0] as any).toolSpec;
      expect(toolSpec).not.toHaveProperty('description');
    });

    it('should include description when it has content', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'function',
            name: 'testFunction',
            description: 'Valid description',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
        modelId: ANTHROPIC_MODEL,
      });

      const toolSpec = (result.toolConfig.tools![0] as any).toolSpec;
      expect(toolSpec.description).toBe('Valid description');
    });
  });

  describe('unsupported provider-defined tools', () => {
    it('should warn for provider-defined tools on non-anthropic models', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'provider',
            id: 'some.custom_tool',
            name: 'custom_tool',
            args: {},
          },
        ],
        modelId: NON_ANTHROPIC_MODEL,
      });

      expect(result.toolConfig).toEqual({});
      expect(result.toolWarnings).toEqual([
        { type: 'unsupported', feature: 'tool some.custom_tool' },
      ]);
    });

    it('should warn and filter out web_search_20250305 tool', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'provider',
            id: 'anthropic.web_search_20250305',
            name: 'web_search',
            args: {},
          },
        ],
        modelId: ANTHROPIC_MODEL,
      });

      expect(result.toolConfig).toEqual({});
      expect(result.toolWarnings).toEqual([
        {
          type: 'unsupported',
          feature: 'web_search_20250305 tool',
          details:
            'The web_search_20250305 tool is not supported on Amazon Bedrock.',
        },
      ]);
    });

    it('should return empty toolConfig when all tools are filtered out', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'provider',
            id: 'anthropic.web_search_20250305',
            name: 'web_search',
            args: {},
          },
        ],
        modelId: ANTHROPIC_MODEL,
      });

      expect(result.toolConfig).toEqual({});
    });
  });

  describe('tool choice', () => {
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
        modelId: NON_ANTHROPIC_MODEL,
      });

      expect(result.toolConfig.toolChoice).toEqual({ auto: {} });
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
        modelId: NON_ANTHROPIC_MODEL,
      });

      expect(result.toolConfig.toolChoice).toEqual({ any: {} });
    });

    it('should handle tool choice "none" by clearing tools', async () => {
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
        modelId: NON_ANTHROPIC_MODEL,
      });

      expect(result.toolConfig).toEqual({});
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
        modelId: NON_ANTHROPIC_MODEL,
      });

      expect(result.toolConfig.toolChoice).toEqual({
        tool: { name: 'testFunction' },
      });
    });

    it('should filter function tools to only the named tool when tool choice is "tool"', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'function',
            name: 'getWeather',
            description: 'Get weather',
            inputSchema: { type: 'object' },
          },
          {
            type: 'function',
            name: 'getTime',
            description: 'Get time',
            inputSchema: { type: 'object' },
          },
        ],
        toolChoice: { type: 'tool', toolName: 'getWeather' },
        modelId: NON_ANTHROPIC_MODEL,
      });

      expect(result.toolConfig.tools).toHaveLength(1);
      expect((result.toolConfig.tools![0] as any).toolSpec.name).toBe(
        'getWeather',
      );
    });
  });

  describe('strict mode for function tools', () => {
    it('should pass through strict mode when strict is true', async () => {
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
        modelId: ANTHROPIC_MODEL,
      });

      expect(result.toolConfig.tools).toEqual([
        {
          toolSpec: {
            name: 'testFunction',
            description: 'A test function',
            strict: true,
            inputSchema: {
              json: { type: 'object', properties: {} },
            },
          },
        },
      ]);
    });

    it('should pass through strict mode when strict is false', async () => {
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
        modelId: ANTHROPIC_MODEL,
      });

      expect(result.toolConfig.tools).toEqual([
        {
          toolSpec: {
            name: 'testFunction',
            description: 'A test function',
            strict: false,
            inputSchema: {
              json: { type: 'object', properties: {} },
            },
          },
        },
      ]);
    });

    it('should not include strict when strict is undefined', async () => {
      const result = await prepareTools({
        tools: [
          {
            type: 'function',
            name: 'testFunction',
            description: 'A test function',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
        modelId: ANTHROPIC_MODEL,
      });

      const toolSpec = (result.toolConfig.tools![0] as any).toolSpec;
      expect(toolSpec).not.toHaveProperty('strict');
    });

    it('should pass through strict mode for multiple tools with different strict settings', async () => {
      const result = await prepareTools({
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
        modelId: ANTHROPIC_MODEL,
      });

      const tools = result.toolConfig.tools!;
      expect((tools[0] as any).toolSpec.strict).toBe(true);
      expect((tools[1] as any).toolSpec.strict).toBe(false);
      expect((tools[2] as any).toolSpec).not.toHaveProperty('strict');
    });

    it('should omit strict for claude-opus-4-7', async () => {
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
        modelId: 'us.anthropic.claude-opus-4-7',
      });

      const toolSpec = (result.toolConfig.tools![0] as any).toolSpec;
      expect(toolSpec).not.toHaveProperty('strict');
    });

    it('should omit strict for claude-opus-4-8', async () => {
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
        modelId: 'anthropic.claude-opus-4-8',
      });

      const toolSpec = (result.toolConfig.tools![0] as any).toolSpec;
      expect(toolSpec).not.toHaveProperty('strict');
    });
  });
});
