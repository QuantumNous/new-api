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
  });
});
