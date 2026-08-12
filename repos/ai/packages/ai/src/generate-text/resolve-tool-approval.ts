import type {
  Context,
  InferToolInput,
  InferToolSetContext,
  ModelMessage,
  ToolSet,
} from '@ai-sdk/provider-utils';
import type {
  ToolApprovalConfiguration,
  ToolApprovalStatus,
} from './tool-approval-configuration';
import type { TypedToolCall } from './tool-call';
import { validateToolContext } from './validate-tool-context';

/**
 * Resolves the approval state for a tool call by checking user-supplied and tool-defined
 * approval settings, and normalizes the result to the object status shape.
 * User-defined approval settings take precedence over tool-defined settings.
 * If no approval settings are provided, the tool call does not require approval.
 */
export async function resolveToolApproval<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context | unknown | never,
>({
  tools,
  toolCall,
  toolApproval,
  messages,
  toolsContext,
  runtimeContext,
}: {
  /**
   * Tools that are available for the model to call.
   */
  tools: TOOLS | undefined;

  /**
   * Valid tool call.
   */
  toolCall: TypedToolCall<TOOLS>;

  /**
   * User-defined approval configuration for tools.
   *
   * This configuration takes precedence over tool-defined approval settings.
   */
  toolApproval: ToolApprovalConfiguration<TOOLS, RUNTIME_CONTEXT> | undefined;

  /**
   * Messages that were sent to the language model to initiate the response that contained the tool call.
   */
  messages: ModelMessage[];

  /**
   * Tool context as defined by the tool's context schema.
   */
  toolsContext: InferToolSetContext<TOOLS>;

  /**
   * User-defined runtime context (same as `runtimeContext` on `generateText` / `streamText`).
   */
  runtimeContext: RUNTIME_CONTEXT;
}): Promise<Exclude<ToolApprovalStatus, string | undefined>> {
  // user-defined generic tool approval
  if (toolApproval != null && typeof toolApproval === 'function') {
    return normalizeToolApprovalStatus(
      await toolApproval({
        toolCall,
        tools,
        toolsContext,
        messages,
        runtimeContext,
      }),
    );
  }

  const toolName = toolCall.toolName;
  const tool = tools?.[toolName];

  // assume that the input has been validated and matches the tool's input schema
  const input = toolCall.input as InferToolInput<TOOLS[keyof TOOLS]>;

  // user-defined per-tool approval
  const userDefinedToolApprovalStatus = toolApproval?.[toolName];
  if (userDefinedToolApprovalStatus != null) {
    const approvalStatus: ToolApprovalStatus | undefined =
      typeof userDefinedToolApprovalStatus === 'function'
        ? await userDefinedToolApprovalStatus(input, {
            toolCallId: toolCall.toolCallId,
            messages,
            toolContext: await validateToolContext({
              toolName,
              context:
                toolsContext?.[toolName as keyof InferToolSetContext<TOOLS>],
              contextSchema: tool?.contextSchema,
            }),
            runtimeContext,
          })
        : userDefinedToolApprovalStatus;

    return normalizeToolApprovalStatus(approvalStatus);
  }

  // tool-defined approval
  if (tool?.needsApproval == null) {
    return { type: 'not-applicable' };
  }

  const needsApproval =
    typeof tool.needsApproval === 'function'
      ? await tool.needsApproval(input, {
          toolCallId: toolCall.toolCallId,
          messages,
          context: await validateToolContext({
            toolName,
            context:
              toolsContext?.[toolName as keyof InferToolSetContext<TOOLS>],
            contextSchema: tool?.contextSchema,
          }),
        })
      : tool.needsApproval;

  return needsApproval ? { type: 'user-approval' } : { type: 'not-applicable' };
}

function normalizeToolApprovalStatus(
  status: ToolApprovalStatus | undefined,
): Exclude<ToolApprovalStatus, string | undefined> {
  return status === undefined
    ? { type: 'not-applicable' }
    : typeof status === 'string'
      ? { type: status }
      : status;
}
