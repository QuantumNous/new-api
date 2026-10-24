import { describe, it, expect } from 'vitest';
import { tool } from 'ai';
import { jsonSchema } from '@ai-sdk/provider-utils';
import {
  serializeToolSet,
  resolveSerializableTools,
} from './serializable-schema';

describe('serializeToolSet', () => {
  it('serializes function tools with description and inputSchema', () => {
    const tools = {
      getWeather: tool({
        description: 'Get weather for a city',
        inputSchema: jsonSchema({
          type: 'object',
          properties: { city: { type: 'string' } },
          required: ['city'],
        }),
      }),
    };

    const serialized = serializeToolSet(tools);

    expect(serialized).toEqual({
      getWeather: {
        description: 'Get weather for a city',
        inputSchema: {
          type: 'object',
          properties: { city: { type: 'string' } },
          required: ['city'],
        },
      },
    });
  });

  it('preserves provider tool type, id, and args', () => {
    // Provider tools (like anthropic.tools.webSearch) have type: 'provider',
    // an id, and args. These must survive serialization so the Gateway can
    // recognize them as provider-executed tools, not plain function tools.
    const tools = {
      webSearch: tool({
        type: 'provider' as const,
        id: 'anthropic.web_search_20250305' as const,
        isProviderExecuted: true,
        args: {
          maxUses: 5,
          allowedDomains: ['vercel.com', 'nextjs.org'],
        },
        inputSchema: jsonSchema({
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        }),
      }),
    };

    const serialized = serializeToolSet(tools);

    expect(serialized.webSearch).toMatchObject({
      type: 'provider',
      id: 'anthropic.web_search_20250305',
      args: {
        maxUses: 5,
        allowedDomains: ['vercel.com', 'nextjs.org'],
      },
    });
  });
});

describe('resolveSerializableTools', () => {
  it('reconstructs function tools with Ajv validation', () => {
    const serialized = {
      getWeather: {
        description: 'Get weather for a city',
        inputSchema: {
          type: 'object' as const,
          properties: { city: { type: 'string' as const } },
          required: ['city'] as string[],
          additionalProperties: false,
        },
      },
    };

    const tools = resolveSerializableTools(serialized);

    expect(tools.getWeather).toBeDefined();
    expect(tools.getWeather.description).toBe('Get weather for a city');
  });

  it('reconstructs provider tools preserving type, id, and args', () => {
    const serialized = {
      webSearch: {
        type: 'provider' as const,
        id: 'anthropic.web_search_20250305' as const,
        args: {
          maxUses: 5,
          allowedDomains: ['vercel.com'],
        },
        inputSchema: {
          type: 'object' as const,
          properties: { query: { type: 'string' as const } },
          required: ['query'] as string[],
        },
      },
    };

    const tools = resolveSerializableTools(serialized);
    const webSearch = tools.webSearch;

    expect(webSearch).toBeDefined();
    expect(webSearch.type).toBe('provider');
    expect((webSearch as any).id).toBe('anthropic.web_search_20250305');
    expect((webSearch as any).args).toEqual({
      maxUses: 5,
      allowedDomains: ['vercel.com'],
    });
  });
});
