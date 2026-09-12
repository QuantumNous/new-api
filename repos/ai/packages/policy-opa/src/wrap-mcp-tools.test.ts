import { jsonSchema, tool } from '@ai-sdk/provider-utils';
import { describe, expect, it } from 'vitest';
import { wrapMcpTools } from './wrap-mcp-tools';

const dummyTool = (description: string) =>
  tool({
    description,
    inputSchema: jsonSchema<{ arg?: string }>({
      type: 'object',
      properties: { arg: { type: 'string' } },
    }),
    execute: async () => 'ok',
  });

const tools = {
  search: dummyTool('search the docs'),
  createIssue: dummyTool('create a new issue'),
  deleteRepo: dummyTool('delete a repo'),
};

type Tools = typeof tools;

function callGenericApproval(
  toolApproval: unknown,
  toolName: keyof Tools,
): unknown {
  if (typeof toolApproval !== 'function') {
    throw new Error('expected a generic approval function');
  }
  return toolApproval({
    toolCall: {
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName,
      input: {},
      dynamic: false,
    } as never,
    tools,
    toolsContext: undefined as never,
    runtimeContext: undefined,
    messages: [],
  });
}

describe('wrapMcpTools', () => {
  describe('function-form approval', () => {
    it('passes the original decision through when the approval matches', async () => {
      const original = async () =>
        ({ type: 'denied', reason: 'no destructive ops' }) as never;
      const { toolApproval } = wrapMcpTools<Tools>(tools, original);

      const status = await callGenericApproval(toolApproval, 'deleteRepo');
      expect(status).toEqual({ type: 'denied', reason: 'no destructive ops' });
    });

    it('falls back to user-approval when the approval returns not-applicable', async () => {
      const original = async () => ({ type: 'not-applicable' }) as never;
      const { toolApproval } = wrapMcpTools<Tools>(tools, original);

      const status = await callGenericApproval(toolApproval, 'search');
      expect(status).toBe('user-approval');
    });

    it('honors the configured default for the fallback case', async () => {
      const original = async () => ({ type: 'not-applicable' }) as never;
      const { toolApproval } = wrapMcpTools<Tools>(tools, original, {
        default: 'denied',
      });

      const status = await callGenericApproval(toolApproval, 'createIssue');
      expect(status).toBe('denied');
    });

    it('treats a string "not-applicable" status as fallback-eligible', async () => {
      const original = async () => 'not-applicable' as never;
      const { toolApproval } = wrapMcpTools<Tools>(tools, original);

      const status = await callGenericApproval(toolApproval, 'search');
      expect(status).toBe('user-approval');
    });

    it('treats undefined as fallback-eligible', async () => {
      const original = async () => undefined as never;
      const { toolApproval } = wrapMcpTools<Tools>(tools, original);

      const status = await callGenericApproval(toolApproval, 'search');
      expect(status).toBe('user-approval');
    });

    it('returns the same tools object reference', () => {
      const result = wrapMcpTools<Tools>(
        tools,
        async () => 'approved' as never,
      );
      expect(result.tools).toBe(tools);
    });
  });

  describe('per-tool-map approval', () => {
    it('preserves explicit per-tool entries', () => {
      const { toolApproval } = wrapMcpTools<Tools>(tools, {
        search: 'approved',
        deleteRepo: { type: 'denied', reason: 'never delete repos' },
      });

      if (typeof toolApproval === 'function') {
        throw new Error('expected per-tool object form');
      }

      expect(toolApproval.search).toBe('approved');
      expect(toolApproval.deleteRepo).toEqual({
        type: 'denied',
        reason: 'never delete repos',
      });
    });

    it('fills in missing tools with the default', () => {
      const { toolApproval } = wrapMcpTools<Tools>(
        tools,
        { search: 'approved' },
        { default: 'user-approval' },
      );

      if (typeof toolApproval === 'function') {
        throw new Error('expected per-tool object form');
      }

      expect(toolApproval.createIssue).toBe('user-approval');
      expect(toolApproval.deleteRepo).toBe('user-approval');
    });

    it('default is user-approval when not specified', () => {
      const { toolApproval } = wrapMcpTools<Tools>(tools, {});

      if (typeof toolApproval === 'function') {
        throw new Error('expected per-tool object form');
      }

      expect(toolApproval.search).toBe('user-approval');
      expect(toolApproval.createIssue).toBe('user-approval');
      expect(toolApproval.deleteRepo).toBe('user-approval');
    });

    it('honors "denied" as a default for hard allowlist mode', () => {
      const { toolApproval } = wrapMcpTools<Tools>(
        tools,
        { search: 'approved' },
        { default: 'denied' },
      );

      if (typeof toolApproval === 'function') {
        throw new Error('expected per-tool object form');
      }

      expect(toolApproval.search).toBe('approved');
      expect(toolApproval.createIssue).toBe('denied');
      expect(toolApproval.deleteRepo).toBe('denied');
    });

    describe('tool names that match inherited object properties', () => {
      // These names resolve to values through `Object.prototype`, so a naive
      // `approval[name]` read would pick up an inherited value instead of
      // undefined and skip the fallback. They must be treated exactly like any
      // other unlisted tool.
      const inheritedTools = {
        constructor: dummyTool('a tool literally named constructor'),
        toString: dummyTool('a tool literally named toString'),
        valueOf: dummyTool('a tool literally named valueOf'),
        unlistedDelete: dummyTool('an ordinary unlisted tool'),
        search: dummyTool('an explicitly listed tool'),
      };
      type InheritedTools = typeof inheritedTools;

      it('applies the "denied" fallback to unlisted inherited-property names', () => {
        const { toolApproval } = wrapMcpTools<InheritedTools>(
          inheritedTools,
          { search: 'approved' } as never,
          { default: 'denied' },
        );

        if (typeof toolApproval === 'function') {
          throw new Error('expected per-tool object form');
        }

        expect(toolApproval.constructor).toBe('denied');
        expect(toolApproval.toString).toBe('denied');
        expect(toolApproval.valueOf).toBe('denied');
        // regression guard: an ordinary unlisted tool still gets the fallback
        expect(toolApproval.unlistedDelete).toBe('denied');
        // an explicitly listed tool keeps its configured decision
        expect(toolApproval.search).toBe('approved');
      });

      it('applies the "user-approval" fallback to unlisted inherited-property names', () => {
        const { toolApproval } = wrapMcpTools<InheritedTools>(
          inheritedTools,
          { search: 'approved' } as never,
          { default: 'user-approval' },
        );

        if (typeof toolApproval === 'function') {
          throw new Error('expected per-tool object form');
        }

        expect(toolApproval.constructor).toBe('user-approval');
        expect(toolApproval.toString).toBe('user-approval');
        expect(toolApproval.valueOf).toBe('user-approval');
        expect(toolApproval.unlistedDelete).toBe('user-approval');
        expect(toolApproval.search).toBe('approved');
      });
    });

    describe('per-tool approval functions', () => {
      // A per-tool approval function that returns a "no opinion" result
      // (`not-applicable`/`undefined`) must fall back to the default, exactly
      // like the generic-function form. Otherwise the tool would resolve to
      // `not-applicable` and run unapproved, defeating the wrapper's purpose.
      it('forces a not-applicable result through the fallback', async () => {
        const { toolApproval } = wrapMcpTools<Tools>(tools, {
          search: (() => ({ type: 'not-applicable' })) as never,
        });

        if (typeof toolApproval === 'function') {
          throw new Error('expected per-tool object form');
        }

        const entry = toolApproval.search;
        if (typeof entry !== 'function') {
          throw new Error('expected wrapped per-tool function');
        }

        const status = await (entry as (...args: unknown[]) => unknown)(
          {},
          {} as never,
        );
        expect(status).toBe('user-approval');
      });

      it('forces an undefined result through the configured default', async () => {
        const { toolApproval } = wrapMcpTools<Tools>(
          tools,
          { search: (() => undefined) as never },
          { default: 'denied' },
        );

        if (typeof toolApproval === 'function') {
          throw new Error('expected per-tool object form');
        }

        const entry = toolApproval.search;
        if (typeof entry !== 'function') {
          throw new Error('expected wrapped per-tool function');
        }

        const status = await (entry as (...args: unknown[]) => unknown)(
          {},
          {} as never,
        );
        expect(status).toBe('denied');
      });

      it('passes a decision through unchanged when the function has an opinion', async () => {
        const decision = { type: 'denied', reason: 'never' };
        const { toolApproval } = wrapMcpTools<Tools>(tools, {
          deleteRepo: (() => decision) as never,
        });

        if (typeof toolApproval === 'function') {
          throw new Error('expected per-tool object form');
        }

        const entry = toolApproval.deleteRepo;
        if (typeof entry !== 'function') {
          throw new Error('expected wrapped per-tool function');
        }

        const status = await (entry as (...args: unknown[]) => unknown)(
          {},
          {} as never,
        );
        expect(status).toEqual(decision);
      });

      it('forwards input and options to the wrapped function', async () => {
        const calls: unknown[][] = [];
        const { toolApproval } = wrapMcpTools<Tools>(tools, {
          search: ((...args: unknown[]) => {
            calls.push(args);
            return 'approved';
          }) as never,
        });

        if (typeof toolApproval === 'function') {
          throw new Error('expected per-tool object form');
        }

        const entry = toolApproval.search as (...args: unknown[]) => unknown;
        const input = { arg: 'value' };
        const options = { toolCallId: 'call-1' };
        await entry(input, options as never);

        expect(calls).toEqual([[input, options]]);
      });
    });
  });
});
