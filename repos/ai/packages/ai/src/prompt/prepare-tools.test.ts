import { z } from 'zod/v4';
import {
  tool,
  type Experimental_SandboxSession as SandboxSession,
  type Tool,
  type ToolSet,
} from '@ai-sdk/provider-utils';
import { describe, expect, it } from 'vitest';
import { mockSandboxSessionFileStubs } from '../test/mock-sandbox';
import { prepareTools } from './prepare-tools';

const mockTools = {
  tool1: tool({
    description: 'Tool 1 description',
    inputSchema: z.object({}),
  }),
  tool2: tool({
    description: 'Tool 2 description',
    inputSchema: z.object({ city: z.string() }),
  }),
};

const mockProviderDefinedTool: Tool = {
  type: 'provider',
  id: 'provider.tool-id',
  isProviderExecuted: false,
  args: { key: 'value' },
  inputSchema: z.object({}),
};

const mockToolsWithProviderDefined = {
  ...mockTools,
  providerTool: mockProviderDefinedTool,
};

describe('prepareTools', () => {
  it('returns undefined when tools are not provided', async () => {
    const result = await prepareTools({ tools: undefined });

    expect(result).toBeUndefined();
  });

  it('returns all tools', async () => {
    const result = await prepareTools({ tools: mockTools });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "description": "Tool 1 description",
          "inputSchema": {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "additionalProperties": false,
            "properties": {},
            "type": "object",
          },
          "name": "tool1",
          "type": "function",
        },
        {
          "description": "Tool 2 description",
          "inputSchema": {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "additionalProperties": false,
            "properties": {
              "city": {
                "type": "string",
              },
            },
            "required": [
              "city",
            ],
            "type": "object",
          },
          "name": "tool2",
          "type": "function",
        },
      ]
    `);
  });

  it('handles provider-defined tools', async () => {
    const result = await prepareTools({ tools: mockToolsWithProviderDefined });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "description": "Tool 1 description",
          "inputSchema": {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "additionalProperties": false,
            "properties": {},
            "type": "object",
          },
          "name": "tool1",
          "type": "function",
        },
        {
          "description": "Tool 2 description",
          "inputSchema": {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "additionalProperties": false,
            "properties": {
              "city": {
                "type": "string",
              },
            },
            "required": [
              "city",
            ],
            "type": "object",
          },
          "name": "tool2",
          "type": "function",
        },
        {
          "args": {
            "key": "value",
          },
          "id": "provider.tool-id",
          "name": "providerTool",
          "type": "provider",
        },
      ]
    `);
  });

  it('orders tools according to a partial toolOrder and appends omitted tools alphabetically', async () => {
    const result = await prepareTools({
      tools: {
        zebra: tool({
          description: 'Zebra tool',
          inputSchema: z.object({}),
        }),
        alpha: tool({
          description: 'Alpha tool',
          inputSchema: z.object({}),
        }),
        providerTool: mockProviderDefinedTool,
        middle: tool({
          description: 'Middle tool',
          inputSchema: z.object({}),
        }),
      },
      toolOrder: ['middle'] as const,
    });

    expect(result?.map(tool => tool.name)).toEqual([
      'middle',
      'alpha',
      'providerTool',
      'zebra',
    ]);
  });

  it('preserves toolOrder entries before alphabetically sorting the remaining tools', async () => {
    const result = await prepareTools({
      tools: {
        zebra: tool({
          description: 'Zebra tool',
          inputSchema: z.object({}),
        }),
        alpha: tool({
          description: 'Alpha tool',
          inputSchema: z.object({}),
        }),
        middle: tool({
          description: 'Middle tool',
          inputSchema: z.object({}),
        }),
      },
      toolOrder: ['zebra', 'middle'] as const,
    });

    expect(result?.map(tool => tool.name)).toEqual([
      'zebra',
      'middle',
      'alpha',
    ]);
  });

  it('does not duplicate tools when toolOrder contains duplicate names', async () => {
    const result = await prepareTools({
      tools: mockTools,
      toolOrder: ['tool2', 'tool2'] as const,
    });

    expect(result?.map(tool => tool.name)).toEqual(['tool2', 'tool1']);
  });

  it('passes through provider options', async () => {
    const result = await prepareTools({
      tools: {
        tool1: tool({
          description: 'Tool 1 description',
          inputSchema: z.object({}),
          providerOptions: {
            aProvider: {
              aSetting: 'aValue',
            },
          },
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "description": "Tool 1 description",
          "inputSchema": {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "additionalProperties": false,
            "properties": {},
            "type": "object",
          },
          "name": "tool1",
          "providerOptions": {
            "aProvider": {
              "aSetting": "aValue",
            },
          },
          "type": "function",
        },
      ]
    `);
  });

  it('passes through strict mode settings', async () => {
    const result = await prepareTools({
      tools: {
        tool1: tool({
          description: 'Tool 1 description',
          inputSchema: z.object({}),
          strict: true,
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "description": "Tool 1 description",
          "inputSchema": {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "additionalProperties": false,
            "properties": {},
            "type": "object",
          },
          "name": "tool1",
          "strict": true,
          "type": "function",
        },
      ]
    `);
  });

  it('passes through input examples', async () => {
    const result = await prepareTools({
      tools: {
        tool1: tool({
          description: 'Tool 1 description',
          inputSchema: z.object({
            city: z.string(),
          }),
          inputExamples: [{ input: { city: 'New York' } }],
        }),
      },
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "description": "Tool 1 description",
          "inputExamples": [
            {
              "input": {
                "city": "New York",
              },
            },
          ],
          "inputSchema": {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "additionalProperties": false,
            "properties": {
              "city": {
                "type": "string",
              },
            },
            "required": [
              "city",
            ],
            "type": "object",
          },
          "name": "tool1",
          "type": "function",
        },
      ]
    `);
  });

  it('resolves function descriptions from toolsContext and sandbox', async () => {
    const sandbox: SandboxSession = {
      description: 'test-sandbox',
      run: async () => ({
        exitCode: 0,
        stdout: '',
        stderr: '',
      }),
      ...mockSandboxSessionFileStubs,
    };

    const result = await prepareTools({
      tools: {
        contextual: {
          type: 'dynamic' as const,
          description: ({ context }: { context: Record<string, unknown> }) =>
            `User is ${String(context.userName)}`,
          inputSchema: z.object({}),
          execute: async () => {},
        },
        withSandbox: {
          type: 'dynamic' as const,
          description: ({
            experimental_sandbox: sandbox,
          }: {
            experimental_sandbox?: SandboxSession;
          }) => `Env: ${sandbox?.description ?? 'none'}`,
          inputSchema: z.object({}),
          execute: async () => {},
        },
      } as unknown as ToolSet,
      toolsContext: { contextual: { userName: 'Ada' } },
      experimental_sandbox: sandbox,
    });

    expect(result).toEqual([
      expect.objectContaining({
        name: 'contextual',
        description: 'User is Ada',
      }),
      expect.objectContaining({
        name: 'withSandbox',
        description: 'Env: test-sandbox',
      }),
    ]);
  });
});
