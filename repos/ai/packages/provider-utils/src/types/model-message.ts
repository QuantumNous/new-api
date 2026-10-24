import type { AssistantModelMessage } from './assistant-model-message';
import type { SystemModelMessage } from './system-model-message';
import type { ToolModelMessage } from './tool-model-message';
import type { UserModelMessage } from './user-model-message';

/**
 * A message that can be used in the `messages` field of a prompt.
 * It can be a user message, an assistant message, or a tool message.
 */
export type ModelMessage =
  | SystemModelMessage
  | UserModelMessage
  | AssistantModelMessage
  | ToolModelMessage;
