import { describe, it, expect } from 'vitest';
import { prepareTools } from './deepseek-prepare-tools';

describe('prepareTools', () => {
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

  it('should not include strict mode when strict is undefined', () => {
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
