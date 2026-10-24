/**
 * Bidirectional control surface returned by `doPromptTurn`.
 *
 * The host uses these methods to feed asynchronous responses back to the
 * adapter while a turn is running. All methods are optional except those
 * the adapter actively supports (host-executed tools require
 * `submitToolResult`; approvals require `submitToolApproval`; mid-turn
 * messages require `submitUserMessage`).
 */
export type HarnessV1PromptControl = {
  /**
   * Provide a result for a `tool-call` the adapter emitted. The adapter
   * forwards the result to the underlying runtime so the model can continue.
   */
  submitToolResult(input: {
    toolCallId: string;
    output: unknown;
    isError?: boolean;
  }): PromiseLike<void>;

  /**
   * Respond to a `tool-approval-request` the adapter emitted.
   */
  submitToolApproval?(input: {
    approvalId: string;
    approved: boolean;
    reason?: string;
  }): PromiseLike<void>;

  /**
   * Inject a fresh user message into a turn that is still in flight.
   * Supported only by runtimes that accept interactive input.
   */
  submitUserMessage?(text: string): PromiseLike<void>;

  /**
   * Resolves when the adapter has finished the turn (success or failure).
   * Rejects with the underlying error when the turn fails.
   */
  readonly done: PromiseLike<void>;
};
