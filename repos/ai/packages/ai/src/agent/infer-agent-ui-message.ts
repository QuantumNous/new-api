import type { InferUITools, UIMessage } from '../ui/ui-messages';
import type { InferAgentTools } from './infer-agent-tools';

/**
 * Infer the UI message type of an agent.
 */
export type InferAgentUIMessage<AGENT, MESSAGE_METADATA = unknown> = UIMessage<
  MESSAGE_METADATA,
  never,
  InferUITools<InferAgentTools<AGENT>>
>;
