import { tool } from '@ai-sdk/provider-utils';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { CollectedToolApprovals } from './collect-tool-approvals';
import { signToolApproval } from './tool-approval-signature';
import { validateApprovedToolApprovals } from './validate-tool-approvals';

function createApproval(
  toolCall: CollectedToolApprovals<any>['toolCall'],
): CollectedToolApprovals<any> {
  return {
    approvalRequest: {
      type: 'tool-approval-request',
      approvalId: 'approval-1',
      toolCallId: toolCall.toolCallId,
    },
    approvalResponse: {
      type: 'tool-approval-response',
      approvalId: 'approval-1',
      approved: true,
    },
    toolCall,
  };
}

describe('validateApprovedToolApprovals', () => {
  it('should keep approvals whose input matches the tool input schema', async () => {
    const tools = {
      tool1: tool({
        inputSchema: z.object({ value: z.string() }),
        execute: async () => 'ok',
      }),
    };

    const approval = createApproval({
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'tool1',
      input: { value: 'test' },
    });

    const result = await validateApprovedToolApprovals({
      approvedToolApprovals: [approval],
      tools,
      toolApproval: undefined,
      messages: [],
      toolsContext: {} as any,
      runtimeContext: {},
    });

    expect(result.approvedToolApprovals).toHaveLength(1);
    expect(result.deniedToolApprovals).toHaveLength(0);
  });

  it('should throw InvalidToolInputError when the input does not match the schema', async () => {
    const tools = {
      tool1: tool({
        inputSchema: z.object({ value: z.string() }),
        execute: async () => 'ok',
      }),
    };

    // Forged input: `value` should be a string.
    const approval = createApproval({
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'tool1',
      input: { value: 42 },
    });

    await expect(
      validateApprovedToolApprovals({
        approvedToolApprovals: [approval],
        tools,
        toolApproval: undefined,
        messages: [],
        toolsContext: {} as any,
        runtimeContext: {},
      }),
    ).rejects.toThrowError(/Invalid input for tool tool1/);
  });

  it('should throw when input contains an extra/forged property not in the schema', async () => {
    const tools = {
      deleteFile: tool({
        inputSchema: z.object({ path: z.string() }).strict(),
        execute: async () => 'deleted',
      }),
    };

    const approval = createApproval({
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'deleteFile',
      input: { path: '/app/.env', extra: 'forged' },
    });

    await expect(
      validateApprovedToolApprovals({
        approvedToolApprovals: [approval],
        tools,
        toolApproval: undefined,
        messages: [],
        toolsContext: {} as any,
        runtimeContext: {},
      }),
    ).rejects.toThrowError(/Invalid input for tool deleteFile/);
  });

  it('should move approvals to denied when the approval policy denies them', async () => {
    const tools = {
      tool1: tool({
        inputSchema: z.object({ value: z.string() }),
        execute: async () => 'ok',
      }),
    };

    const approval = createApproval({
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'tool1',
      input: { value: 'test' },
    });

    const result = await validateApprovedToolApprovals({
      approvedToolApprovals: [approval],
      tools,
      // server-side policy denies the call regardless of the client's response
      toolApproval: { tool1: 'denied' },
      messages: [],
      toolsContext: {} as any,
      runtimeContext: {},
    });

    expect(result.approvedToolApprovals).toHaveLength(0);
    expect(result.deniedToolApprovals).toHaveLength(1);
    expect(result.deniedToolApprovals[0].approvalResponse.approved).toBe(false);
  });

  it('should carry the policy reason into the denial response', async () => {
    const tools = {
      tool1: tool({
        inputSchema: z.object({ value: z.string() }),
        execute: async () => 'ok',
      }),
    };

    const approval = createApproval({
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'tool1',
      input: { value: 'test' },
    });

    const result = await validateApprovedToolApprovals({
      approvedToolApprovals: [approval],
      tools,
      toolApproval: {
        tool1: { type: 'denied', reason: 'policy changed' },
      },
      messages: [],
      toolsContext: {} as any,
      runtimeContext: {},
    });

    expect(result.deniedToolApprovals).toHaveLength(1);
    expect(result.deniedToolApprovals[0].approvalResponse.reason).toBe(
      'policy changed',
    );
    expect(result.deniedToolApprovals[0].approvalResponse.approved).toBe(false);
  });

  it('should re-run a function-based approval policy on the approved input', async () => {
    const approvalPolicy = vi.fn().mockResolvedValue('denied');
    const tools = {
      tool1: tool({
        inputSchema: z.object({ value: z.string() }),
        execute: async () => 'ok',
      }),
    };

    const approval = createApproval({
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'tool1',
      input: { value: 'test' },
    });

    const result = await validateApprovedToolApprovals({
      approvedToolApprovals: [approval],
      tools,
      // per-tool approval policy re-evaluated against the approved input
      toolApproval: { tool1: approvalPolicy },
      messages: [],
      toolsContext: {} as any,
      runtimeContext: {},
    });

    expect(approvalPolicy).toHaveBeenCalledWith(
      { value: 'test' },
      expect.objectContaining({ toolCallId: 'call-1' }),
    );
    expect(result.approvedToolApprovals).toHaveLength(0);
    expect(result.deniedToolApprovals).toHaveLength(1);
  });

  it('should pass through approvals for tools without an execute function (not validated)', async () => {
    const tools = {
      tool1: tool({
        inputSchema: z.object({ value: z.string() }),
        // no execute -> client-side tool, not run on the server
      }),
    };

    const approval = createApproval({
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'tool1',
      input: { value: 42 },
    });

    const result = await validateApprovedToolApprovals({
      approvedToolApprovals: [approval],
      tools,
      toolApproval: undefined,
      messages: [],
      toolsContext: {} as any,
      runtimeContext: {},
    });

    expect(result.approvedToolApprovals).toHaveLength(1);
    expect(result.deniedToolApprovals).toHaveLength(0);
  });

  describe('signature verification (experimental_toolApprovalSecret)', () => {
    const secret = 'test-secret-for-signature';

    it('should pass when the signature is valid', async () => {
      const tools = {
        tool1: tool({
          inputSchema: z.object({ value: z.string() }),
          execute: async () => 'ok',
        }),
      };

      const approvalId = 'approval-signed';
      const toolCallId = 'call-1';
      const toolName = 'tool1';
      const input = { value: 'test' };

      const signature = await signToolApproval({
        secret,
        approvalId,
        toolCallId,
        toolName,
        input,
      });

      const approval: CollectedToolApprovals<any> = {
        approvalRequest: {
          type: 'tool-approval-request',
          approvalId,
          toolCallId,
          signature,
        },
        approvalResponse: {
          type: 'tool-approval-response',
          approvalId,
          approved: true,
        },
        toolCall: {
          type: 'tool-call',
          toolCallId,
          toolName,
          input,
        },
      };

      const result = await validateApprovedToolApprovals({
        approvedToolApprovals: [approval],
        tools,
        toolApproval: undefined,
        messages: [],
        toolsContext: {} as any,
        runtimeContext: {},
        toolApprovalSecret: secret,
      });

      expect(result.approvedToolApprovals).toHaveLength(1);
    });

    it('should throw when the signature is missing and secret is configured', async () => {
      const tools = {
        tool1: tool({
          inputSchema: z.object({ value: z.string() }),
          execute: async () => 'ok',
        }),
      };

      const approval = createApproval({
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'tool1',
        input: { value: 'test' },
      });

      await expect(
        validateApprovedToolApprovals({
          approvedToolApprovals: [approval],
          tools,
          toolApproval: undefined,
          messages: [],
          toolsContext: {} as any,
          runtimeContext: {},
          toolApprovalSecret: secret,
        }),
      ).rejects.toThrowError(/missing signature/);
    });

    it('should throw when the signature is invalid (tampered input)', async () => {
      const tools = {
        tool1: tool({
          inputSchema: z.object({ value: z.string() }),
          execute: async () => 'ok',
        }),
      };

      const signature = await signToolApproval({
        secret,
        approvalId: 'approval-1',
        toolCallId: 'call-1',
        toolName: 'tool1',
        input: { value: 'original' },
      });

      const approval: CollectedToolApprovals<any> = {
        approvalRequest: {
          type: 'tool-approval-request',
          approvalId: 'approval-1',
          toolCallId: 'call-1',
          signature,
        },
        approvalResponse: {
          type: 'tool-approval-response',
          approvalId: 'approval-1',
          approved: true,
        },
        toolCall: {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'tool1',
          input: { value: 'tampered' },
        },
      };

      await expect(
        validateApprovedToolApprovals({
          approvedToolApprovals: [approval],
          tools,
          toolApproval: undefined,
          messages: [],
          toolsContext: {} as any,
          runtimeContext: {},
          toolApprovalSecret: secret,
        }),
      ).rejects.toThrowError(/invalid signature/);
    });

    it('should ignore signature when no secret is configured (forward compatible)', async () => {
      const tools = {
        tool1: tool({
          inputSchema: z.object({ value: z.string() }),
          execute: async () => 'ok',
        }),
      };

      const approval: CollectedToolApprovals<any> = {
        approvalRequest: {
          type: 'tool-approval-request',
          approvalId: 'approval-1',
          toolCallId: 'call-1',
          signature: 'some-random-signature',
        },
        approvalResponse: {
          type: 'tool-approval-response',
          approvalId: 'approval-1',
          approved: true,
        },
        toolCall: {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'tool1',
          input: { value: 'test' },
        },
      };

      const result = await validateApprovedToolApprovals({
        approvedToolApprovals: [approval],
        tools,
        toolApproval: undefined,
        messages: [],
        toolsContext: {} as any,
        runtimeContext: {},
      });

      expect(result.approvedToolApprovals).toHaveLength(1);
    });
  });
});
