/**
 * A conversation item that can be created by the client and sent to
 * the model via the conversation.item.create event.
 */
export type RealtimeModelV4ConversationItem =
  | RealtimeModelV4TextMessage
  | RealtimeModelV4AudioMessage
  | RealtimeModelV4FunctionCallOutput;

/**
 * A text message from the user.
 */
export type RealtimeModelV4TextMessage = {
  type: 'text-message';
  role: 'user';
  text: string;
};

/**
 * An audio message from the user (complete audio, not streamed).
 */
export type RealtimeModelV4AudioMessage = {
  type: 'audio-message';
  role: 'user';

  /**
   * Base64-encoded audio data.
   */
  audio: string;
};

/**
 * The output of a function call, sent back to the model so it can
 * continue generating a response using the tool result.
 */
export type RealtimeModelV4FunctionCallOutput = {
  type: 'function-call-output';

  /**
   * The call ID from the function-call-arguments-done event.
   * Must match so the model knows which function call this result is for.
   */
  callId: string;

  /**
   * The name of the function that was called.
   * Required by some providers (e.g. Google) in the tool response routing.
   */
  name?: string;

  /**
   * JSON string containing the function call result.
   */
  output: string;
};
