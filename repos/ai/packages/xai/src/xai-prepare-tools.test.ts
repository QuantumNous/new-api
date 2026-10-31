import { describe, expect, it } from 'vitest';
import { prepareTools } from './xai-prepare-tools';

describe('prepareTools', () => {
  it('should return undefined tools and toolChoice when tools are undefined', () => {
    const result = prepareTools({
      tools: undefined,
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
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "toolChoice": undefined,
        "toolWarnings": [],
        "tools": [
          {
            "function": {
              "description": "A test function",
              "name": "testFunction",
              "parameters": {
                "properties": {},
                "type": "object",
              },
            },
            "type": "function",
          },
        ],
      }
    `);
  });

  it('should add warnings for provider-defined tools', () => {
    const result = prepareTools({
      tools: [
        {
          type: 'provider',
          id: 'xai.unsupported_tool',
          name: 'unsupported_tool',
          args: {},
        },
      ],
    });

    expect(result.tools).toEqual([]);
    expect(result.toolChoice).toBeUndefined();
    expect(result.toolWarnings).toMatchInlineSnapshot(`
      [
        {
          "feature": "provider-defined tool unsupported_tool",
          "type": "unsupported",
        },
      ]
    `);
  });

  it('should handle multiple tools including provider-defined and function tools', () => {
    const result = prepareTools({
      tools: [
        {
          type: 'function',
          name: 'calculator',
          description: 'calculate numbers',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          type: 'provider',
          id: 'xai.some_tool',
          name: 'some_tool',
          args: {},
        },
        {
          type: 'function',
          name: 'weather',
          description: 'get weather',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
    });

    expect(result.tools).toHaveLength(2);
    expect(result.tools![0].function.name).toBe('calculator');
    expect(result.tools![1].function.name).toBe('weather');
    expect(result.toolWarnings).toHaveLength(1);
    expect(result.toolWarnings[0]).toEqual({
      type: 'unsupported',
      feature: 'provider-defined tool some_tool',
    });
  });

  describe('tool choice', () => {
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
      });
      expect(result.toolChoice).toBe('auto');
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
      });
      expect(result.toolChoice).toBe('none');
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
      });
      expect(result.toolChoice).toBe('required');
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
      });
      expect(result.toolChoice).toEqual({
        type: 'function',
        function: { name: 'testFunction' },
      });
    });

    it('should return undefined toolChoice when toolChoice is not provided', () => {
      const result = prepareTools({
        tools: [
          {
            type: 'function',
            name: 'testFunction',
            description: 'Test',
            inputSchema: {},
          },
        ],
      });
      expect(result.toolChoice).toBeUndefined();
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
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "function": {
                "description": "A test function",
                "name": "testFunction",
                "parameters": {
                  "properties": {},
                  "type": "object",
                },
                "strict": true,
              },
              "type": "function",
            },
          ],
        }
      `);
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
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "function": {
                "description": "A test function",
                "name": "testFunction",
                "parameters": {
                  "properties": {},
                  "type": "object",
                },
                "strict": false,
              },
              "type": "function",
            },
          ],
        }
      `);
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
      });

      const functionDef = result.tools![0].function;
      expect(functionDef).not.toHaveProperty('strict');
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
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "toolChoice": undefined,
          "toolWarnings": [],
          "tools": [
            {
              "function": {
                "description": "A strict tool",
                "name": "strictTool",
                "parameters": {
                  "properties": {},
                  "type": "object",
                },
                "strict": true,
              },
              "type": "function",
            },
            {
              "function": {
                "description": "A non-strict tool",
                "name": "nonStrictTool",
                "parameters": {
                  "properties": {},
                  "type": "object",
                },
                "strict": false,
              },
              "type": "function",
            },
            {
              "function": {
                "description": "A tool without strict setting",
                "name": "defaultTool",
                "parameters": {
                  "properties": {},
                  "type": "object",
                },
              },
              "type": "function",
            },
          ],
        }
      `);
    });
  });
});
