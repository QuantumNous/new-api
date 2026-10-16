import { prepareTools } from './cohere-prepare-tools';
import { describe, it, expect } from 'vitest';

it('should return undefined tools when no tools are provided', () => {
  const result = prepareTools({
    tools: [],
  });

  expect(result).toStrictEqual({
    tools: undefined,
    toolChoice: undefined,
    toolWarnings: [],
  });
});

it('should process function tools correctly', () => {
  const functionTool = {
    type: 'function' as const,
    name: 'testFunction',
    description: 'test description',
    inputSchema: { type: 'object' as const, properties: {} },
  };

  const result = prepareTools({
    tools: [functionTool],
  });

  expect(result).toStrictEqual({
    tools: [
      {
        type: 'function',
        function: {
          name: 'testFunction',
          description: 'test description',
          parameters: { type: 'object' as const, properties: {} },
        },
      },
    ],
    toolChoice: undefined,
    toolWarnings: [],
  });
});

it('should add warnings for provider-defined tools', () => {
  const result = prepareTools({
    tools: [
      {
        type: 'provider' as const,
        id: 'provider.tool',
        name: 'tool',
        args: {},
      },
    ],
  });

  expect(result).toMatchInlineSnapshot(`
    {
      "toolChoice": undefined,
      "toolWarnings": [
        {
          "feature": "provider-defined tool provider.tool",
          "type": "unsupported",
        },
      ],
      "tools": [],
    }
  `);
});

describe('tool choice handling', () => {
  const basicTool = {
    type: 'function' as const,
    name: 'testFunction',
    description: 'test description',
    inputSchema: { type: 'object' as const, properties: {} },
  };

  it('should handle auto tool choice', () => {
    const result = prepareTools({
      tools: [basicTool],
      toolChoice: { type: 'auto' },
    });

    expect(result.toolChoice).toBe(undefined);
  });

  it('should handle none tool choice', () => {
    const result = prepareTools({
      tools: [basicTool],
      toolChoice: { type: 'none' },
    });

    expect(result).toStrictEqual({
      tools: [
        {
          type: 'function',
          function: {
            name: 'testFunction',
            description: 'test description',
            parameters: { type: 'object', properties: {} },
          },
        },
      ],
      toolChoice: 'NONE',
      toolWarnings: [],
    });
  });

  it('should handle required tool choice', () => {
    const result = prepareTools({
      tools: [basicTool],
      toolChoice: { type: 'required' },
    });

    expect(result).toStrictEqual({
      tools: [
        {
          type: 'function',
          function: {
            name: 'testFunction',
            description: 'test description',
            parameters: { type: 'object', properties: {} },
          },
        },
      ],
      toolChoice: 'REQUIRED',
      toolWarnings: [],
    });
  });

  it('should handle tool type tool choice by filtering tools', () => {
    const result = prepareTools({
      tools: [basicTool],
      toolChoice: { type: 'tool', toolName: 'testFunction' },
    });

    expect(result).toStrictEqual({
      tools: [
        {
          type: 'function',
          function: {
            name: 'testFunction',
            description: 'test description',
            parameters: { type: 'object', properties: {} },
          },
        },
      ],
      toolChoice: 'REQUIRED',
      toolWarnings: [],
    });
  });
});
