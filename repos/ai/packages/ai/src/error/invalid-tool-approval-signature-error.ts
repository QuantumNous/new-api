import { AISDKError } from '@ai-sdk/provider';

const name = 'AI_InvalidToolApprovalSignatureError';
const marker = `vercel.ai.error.${name}`;
const symbol = Symbol.for(marker);

export class InvalidToolApprovalSignatureError extends AISDKError {
  private readonly [symbol] = true;

  readonly approvalId: string;
  readonly toolCallId: string;

  constructor({
    approvalId,
    toolCallId,
    reason,
  }: {
    approvalId: string;
    toolCallId: string;
    reason: string;
  }) {
    super({
      name,
      message: `Tool approval signature verification failed for approval "${approvalId}" (tool call "${toolCallId}"): ${reason}`,
    });
    this.approvalId = approvalId;
    this.toolCallId = toolCallId;
  }

  static isInstance(
    error: unknown,
  ): error is InvalidToolApprovalSignatureError {
    return AISDKError.hasMarker(error, marker);
  }
}
