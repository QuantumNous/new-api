import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4FunctionTool,
  LanguageModelV4ProviderTool,
} from '@ai-sdk/provider';
import { describe, expect, it, vi } from 'vitest';
import type { PolicyClient } from '../policy-client';
import { opaCapabilityMiddleware } from './opa-capability-middleware';
import { stubClient } from './test-helpers';

function tool(name: string): LanguageModelV4FunctionTool {
  return {
    type: 'function',
    name,
    description: name,
    inputSchema: {
      type: 'object',
      properties: {},
    } as never,
  };
}

function providerTool(
  id: `${string}.${string}`,
  name: string,
): LanguageModelV4ProviderTool {
  return { type: 'provider', id, name, args: {} };
}

function baseParams(
  tools?: LanguageModelV4CallOptions['tools'],
): LanguageModelV4CallOptions {
  return {
    prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    tools,
  } as LanguageModelV4CallOptions;
}

const fakeModel = {} as unknown as LanguageModelV4;

describe('opaCapabilityMiddleware', () => {
  it('filters tools to the OPA allowlist when given a string[]', async () => {
    const mw = opaCapabilityMiddleware({
      client: stubClient(['search', 'readDocs']),
      path: 'agent/tools/allowed',
    });

    const transformed = await mw.transformParams!({
      type: 'generate',
      model: fakeModel,
      params: baseParams([
        tool('search'),
        tool('writeFile'),
        tool('readDocs'),
        tool('deleteRepo'),
      ]),
    });

    const names = transformed.tools?.map(t =>
      t.type === 'function' ? t.name : t.id,
    );
    expect(names).toEqual(['search', 'readDocs']);
  });

  it('keeps a provider tool whose dotted id is allowlisted', async () => {
    const mw = opaCapabilityMiddleware({
      client: stubClient(['openai.web_search_preview']),
      path: 'agent/tools/allowed',
    });

    const transformed = await mw.transformParams!({
      type: 'generate',
      model: fakeModel,
      params: baseParams([
        providerTool('openai.web_search_preview', 'web_search_preview'),
        providerTool('openai.file_search', 'file_search'),
      ]),
    });

    expect(
      transformed.tools?.map(t => (t.type === 'provider' ? t.id : t.name)),
    ).toEqual(['openai.web_search_preview']);
  });

  it('keeps a provider tool whose bare name is allowlisted (not just the id)', async () => {
    const mw = opaCapabilityMiddleware({
      client: stubClient(['web_search_preview']),
      path: 'agent/tools/allowed',
    });

    const transformed = await mw.transformParams!({
      type: 'generate',
      model: fakeModel,
      params: baseParams([
        providerTool('openai.web_search_preview', 'web_search_preview'),
        providerTool('openai.file_search', 'file_search'),
      ]),
    });

    expect(
      transformed.tools?.map(t => (t.type === 'provider' ? t.id : t.name)),
    ).toEqual(['openai.web_search_preview']);
  });

  it('accepts the { tools: [...] } object form', async () => {
    const mw = opaCapabilityMiddleware({
      client: stubClient({ tools: ['search'] }),
      path: 'agent/tools/allowed',
    });

    const transformed = await mw.transformParams!({
      type: 'generate',
      model: fakeModel,
      params: baseParams([tool('search'), tool('writeFile')]),
    });

    expect(
      transformed.tools?.map(t => t.type === 'function' && t.name),
    ).toEqual(['search']);
  });

  it('drops every tool when the result is malformed (fail closed)', async () => {
    const mw = opaCapabilityMiddleware({
      client: stubClient({ result: 'oops' }),
      path: 'p',
    });

    const transformed = await mw.transformParams!({
      type: 'generate',
      model: fakeModel,
      params: baseParams([tool('search'), tool('readDocs')]),
    });

    expect(transformed.tools).toBeUndefined();
  });

  it('drops every tool when the OPA client throws (fail closed)', async () => {
    const failing: PolicyClient = {
      async evaluate() {
        throw new Error('OPA unreachable');
      },
    };
    const mw = opaCapabilityMiddleware({ client: failing, path: 'p' });

    const transformed = await mw.transformParams!({
      type: 'generate',
      model: fakeModel,
      params: baseParams([tool('search')]),
    });

    expect(transformed.tools).toBeUndefined();
  });

  it('passes params through unchanged when no tools are present', async () => {
    const evaluate = vi.fn();
    const mw = opaCapabilityMiddleware({
      client: { evaluate: evaluate as never },
      path: 'p',
    });

    const params = baseParams(undefined);
    const transformed = await mw.transformParams!({
      type: 'generate',
      model: fakeModel,
      params,
    });

    expect(transformed).toBe(params);
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('preserves object identity when nothing was dropped', async () => {
    const mw = opaCapabilityMiddleware({
      client: stubClient(['search', 'readDocs']),
      path: 'p',
    });

    const params = baseParams([tool('search'), tool('readDocs')]);
    const transformed = await mw.transformParams!({
      type: 'generate',
      model: fakeModel,
      params,
    });

    expect(transformed).toBe(params);
  });

  it('honors a custom toInput transformer', async () => {
    const evaluate = vi.fn(async () => ['search'] as never);
    const client: PolicyClient = { evaluate };

    const mw = opaCapabilityMiddleware({
      client,
      path: 'p',
      toInput: ({ providerOptions }) => ({
        identity: (providerOptions as { identity?: unknown } | undefined)
          ?.identity,
      }),
    });

    await mw.transformParams!({
      type: 'generate',
      model: fakeModel,
      params: {
        ...baseParams([tool('search')]),
        providerOptions: { identity: { role: 'oncall' } } as never,
      },
    });

    expect(evaluate).toHaveBeenCalledWith('p', {
      identity: { role: 'oncall' },
    });
  });

  it('returns empty tools array when allowlist matches nothing', async () => {
    const mw = opaCapabilityMiddleware({
      client: stubClient(['somethingElse']),
      path: 'p',
    });

    const transformed = await mw.transformParams!({
      type: 'generate',
      model: fakeModel,
      params: baseParams([tool('search'), tool('readDocs')]),
    });

    expect(transformed.tools).toEqual([]);
  });
});
