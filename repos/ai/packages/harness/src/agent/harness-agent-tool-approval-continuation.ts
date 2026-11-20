import { HarnessError } from '../errors/harness-error';
import type {
  ModelMessage,
  ToolApprovalRequest,
  ToolApprovalResponse,
} from '@ai-sdk/provider-utils';

export type HarnessAgentToolApprovalContinuation = {
  readonly approvalResponse: ToolApprovalResponse;
  readonly toolCall: {
    readonly type: 'tool-call';
    readonly toolCallId: string;
    readonly toolName: string;
    readonly input: unknown;
    readonly providerExecuted?: boolean;
  };
};

/**
 * Extract approval decisions that should continue a suspended harness turn.
 *
 * AI SDK clients send approval decisions as a trailing `role: "tool"` message
 * containing `tool-approval-response` parts. The response only carries the
 * approval id, so the harness has to recover the matching approval request
 * locally to find the original tool call before it can resume the paused turn.
 * Responses that already have a tool result are ignored, because those
 * approvals were already consumed by a prior continuation.
 */
export function collectHarnessAgentToolApprovalContinuations(input: {
  messages: readonly ModelMessage[];
}): readonly HarnessAgentToolApprovalContinuation[] {
  const lastMessage = input.messages.at(-1);
  if (lastMessage?.role !== 'tool') return [];

  const toolCallsByToolCallId = new Map<
    string,
    HarnessAgentToolApprovalContinuation['toolCall']
  >();
  const approvalRequestsByApprovalId = new Map<string, ToolApprovalRequest>();
  for (const message of input.messages) {
    if (message.role !== 'assistant' || typeof message.content === 'string') {
      continue;
    }
    for (const part of message.content) {
      if (part.type === 'tool-call') {
        toolCallsByToolCallId.set(part.toolCallId, {
          type: 'tool-call',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input: part.input,
          ...(part.providerExecuted !== undefined
            ? { providerExecuted: part.providerExecuted }
            : {}),
        });
      } else if (part.type === 'tool-approval-request') {
        approvalRequestsByApprovalId.set(part.approvalId, part);
      }
    }
  }

  const toolResultIds = new Set<string>();
  for (const part of lastMessage.content) {
    if (part.type === 'tool-result') {
      toolResultIds.add(part.toolCallId);
    }
  }

  const continuations: HarnessAgentToolApprovalContinuation[] = [];
  for (const part of lastMessage.content) {
    if (part.type !== 'tool-approval-response') continue;

    const approvalRequest = approvalRequestsByApprovalId.get(part.approvalId);
    if (approvalRequest == null) {
      throw new HarnessError({
        message: `Tool approval response '${part.approvalId}' does not match a prior tool approval request.`,
      });
    }
    if (toolResultIds.has(approvalRequest.toolCallId)) continue;

    const toolCall = toolCallsByToolCallId.get(approvalRequest.toolCallId);
    if (toolCall == null) {
      throw new HarnessError({
        message: `Tool approval request '${approvalRequest.approvalId}' references unknown tool call '${approvalRequest.toolCallId}'.`,
      });
    }

    continuations.push({
      approvalResponse: part,
      toolCall,
    });
  }

  return continuations;
}
