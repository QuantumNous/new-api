import type { UIMessage } from '../ui/ui-messages';
import type { UIMessageStreamOnEndCallback } from './ui-message-stream-on-end-callback';

/**
 * @deprecated Use `UIMessageStreamOnEndCallback` instead.
 */
export type UIMessageStreamOnFinishCallback<UI_MESSAGE extends UIMessage> =
  UIMessageStreamOnEndCallback<UI_MESSAGE>;
