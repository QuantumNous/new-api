import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { tool, type Tool } from '@ai-sdk/provider-utils';
import { filterActiveTools } from './filter-active-tools';

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

describe('filterActiveTools', () => {
  it('should return undefined when tools are not provided', () => {
    const result = filterActiveTools({
      tools: undefined,
      activeTools: ['tool1'],
    });

    expect(result).toBeUndefined();
  });

  it('should return all tools when activeTools is not provided', () => {
    const result = filterActiveTools({
      tools: mockToolsWithProviderDefined,
      activeTools: undefined,
    });

    expect(result).toBe(mockToolsWithProviderDefined);
  });

  it('should return no tools when activeTools is empty', () => {
    const result = filterActiveTools({
      tools: mockToolsWithProviderDefined,
      activeTools: [],
    });

    expect(result).toEqual({});
  });

  it('should filter tools based on activeTools', () => {
    const result = filterActiveTools({
      tools: mockToolsWithProviderDefined,
      activeTools: ['tool1', 'providerTool'],
    });

    expect(result).toEqual({
      tool1: mockTools.tool1,
      providerTool: mockProviderDefinedTool,
    });
  });
});
