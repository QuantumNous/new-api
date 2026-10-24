import type { TypedToolCall } from './tool-call';
import type { ToolSet } from '@ai-sdk/provider-utils';

/**
 * Output part that indicates that a tool approval response is available.
 */
export type ToolApprovalResponseOutput<TOOLS extends ToolSet> = {
  type: 'tool-approval-response';

  /**
   * ID of the tool approval.
   */
  approvalId: string;

  /**
   * Tool call that the approval response is for.
   */
  toolCall: TypedToolCall<TOOLS>;

  /**
   * Flag indicating whether the approval was granted or denied.
   */
  approved: boolean;

  /**
   * Optional reason for the approval or denial.
   */
  reason?: string;

  /**
   * Flag indicating whether the tool call is provider-executed.
   * Only provider-executed tool approval responses should be sent to the model.
   */
  providerExecuted?: boolean;
};
