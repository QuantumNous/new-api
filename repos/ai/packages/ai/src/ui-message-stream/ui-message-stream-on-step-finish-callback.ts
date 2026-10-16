import type { UIMessage } from '../ui/ui-messages';
import type { UIMessageStreamOnStepEndCallback } from './ui-message-stream-on-step-end-callback';

/**
 * Callback that is called when a step finishes during streaming.
 * This is useful for persisting intermediate UI messages during multi-step agent runs.
 *
 * @deprecated Use `UIMessageStreamOnStepEndCallback` instead.
 */
export type UIMessageStreamOnStepFinishCallback<UI_MESSAGE extends UIMessage> =
  UIMessageStreamOnStepEndCallback<UI_MESSAGE>;
