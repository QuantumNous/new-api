import type {
  ModelMessage,
  ToolApprovalRequest,
  ToolApprovalResponse,
  ToolResultPart,
  ToolSet,
} from '@ai-sdk/provider-utils';
import { InvalidToolApprovalError } from '../error/invalid-tool-approval-error';
import { ToolCallNotFoundForApprovalError } from '../error/tool-call-not-found-for-approval-error';
import type { TypedToolCall } from './tool-call';

export type CollectedToolApprovals<TOOLS extends ToolSet> = {
  approvalRequest: ToolApprovalRequest;
  approvalResponse: ToolApprovalResponse;
  toolCall: TypedToolCall<TOOLS>;
  existingToolResult?: ToolResultPart;
};

/**
 * If the last message is a tool message, this function collects all tool approvals
 * from that message.
 */
export function collectToolApprovals<TOOLS extends ToolSet>({
  messages,
}: {
  messages: ModelMessage[];
}): {
  approvedToolApprovals: Array<CollectedToolApprovals<TOOLS>>;
  deniedToolApprovals: Array<CollectedToolApprovals<TOOLS>>;
} {
  const lastMessage = messages.at(-1);

  if (lastMessage?.role != 'tool') {
    return {
      approvedToolApprovals: [],
      deniedToolApprovals: [],
    };
  }

  // gather tool calls and prepare lookup.
  //
  // These maps are keyed by client-supplied ids (`toolCallId`, `approvalId`)
  // from the message history. Using `Object.create(null)` gives them no
  // prototype, so an id that matches an inherited object property (e.g.
  // `toString`, `constructor`, `__proto__`) is treated as absent instead of
  // resolving to a prototype value and slipping past the `== null` guards
  // below (which would otherwise skip the InvalidToolApproval /
  // ToolCallNotFound checks).
  const toolCallsByToolCallId: Record<
    string,
    TypedToolCall<TOOLS>
  > = Object.create(null);
  for (const message of messages) {
    if (message.role === 'assistant' && typeof message.content !== 'string') {
      const content = message.content;
      for (const part of content) {
        if (part.type === 'tool-call') {
          toolCallsByToolCallId[part.toolCallId] = part as TypedToolCall<TOOLS>;
        }
      }
    }
  }

  // gather approval responses and prepare lookup
  const toolApprovalRequestsByApprovalId: Record<string, ToolApprovalRequest> =
    Object.create(null);
  for (const message of messages) {
    if (message.role === 'assistant' && typeof message.content !== 'string') {
      const content = message.content;
      for (const part of content) {
        if (part.type === 'tool-approval-request') {
          toolApprovalRequestsByApprovalId[part.approvalId] = part;
        }
      }
    }
  }

  // gather tool results from the last tool message
  const toolResults: Record<string, ToolResultPart> = Object.create(null);
  for (const part of lastMessage.content) {
    if (part.type === 'tool-result') {
      toolResults[part.toolCallId] = part;
    }
  }

  const approvedToolApprovals: Array<CollectedToolApprovals<TOOLS>> = [];
  const deniedToolApprovals: Array<CollectedToolApprovals<TOOLS>> = [];

  const approvalResponses = lastMessage.content.filter(
    part => part.type === 'tool-approval-response',
  );
  for (const approvalResponse of approvalResponses) {
    const approvalRequest =
      toolApprovalRequestsByApprovalId[approvalResponse.approvalId];

    if (approvalRequest == null) {
      throw new InvalidToolApprovalError({
        approvalId: approvalResponse.approvalId,
      });
    }

    const existingToolResult = toolResults[approvalRequest.toolCallId];
    if (
      existingToolResult != null &&
      (approvalResponse.approved ||
        existingToolResult.output.type !== 'execution-denied')
    ) {
      continue;
    }

    const toolCall = toolCallsByToolCallId[approvalRequest.toolCallId];
    if (toolCall == null) {
      throw new ToolCallNotFoundForApprovalError({
        toolCallId: approvalRequest.toolCallId,
        approvalId: approvalRequest.approvalId,
      });
    }

    const approval: CollectedToolApprovals<TOOLS> = {
      approvalRequest,
      approvalResponse,
      toolCall,
      ...(existingToolResult != null ? { existingToolResult } : {}),
    };

    if (approvalResponse.approved) {
      approvedToolApprovals.push(approval);
    } else {
      deniedToolApprovals.push(approval);
    }
  }

  return { approvedToolApprovals, deniedToolApprovals };
}
