import type { AIMessageChunk } from '@langchain/core/messages';

export interface LangGraphMessageSeen {
  text?: boolean;
  reasoning?: boolean;
  tool?: Set<string>;
}

/**
 * State for LangGraph event processing
 */
export interface LangGraphEventState {
  /** Tracks which message IDs have been seen */
  messageSeen: Map<string, LangGraphMessageSeen>;
  /** Accumulates message chunks for later reference */
  messageConcat: Map<string, AIMessageChunk>;
  /** Tracks which tool call IDs have emitted tool-input-start */
  emittedToolCalls: Set<string>;
  /** Tracks which tool call IDs have emitted complete tool inputs */
  emittedToolInputs: Set<string>;
  /** Maps image IDs to their message IDs (for chunks that don't include the ID) */
  emittedImages: Set<string>;
  /** Maps reasoning block IDs to their message IDs (for chunks that don't include the ID) */
  emittedReasoningIds: Set<string>;
  /** Maps message IDs to their reasoning block IDs (for chunks that don't include the ID) */
  messageReasoningIds: Map<string, string>;
  /** Maps message ID + tool call index to tool call info (for streaming chunks without ID) */
  toolCallInfoByIndex: Map<string, Map<number, { id: string; name: string }>>;
  /** Tracks the current LangGraph step for start-step/finish-step events */
  currentStep: number | null;
  /** Maps tool call key (name:argsJson) to tool call ID for HITL interrupt handling */
  emittedToolCallsByKey: Map<string, string>;
  /** Tracks source IDs already emitted to avoid duplicates across messages/values events */
  emittedSourceIds: Set<string>;
}

/**
 * A LangChain citation projected to the fields the AI SDK source parts can carry.
 */
export interface NormalizedCitation {
  url?: string;
  title?: string;
  source?: string;
  citedText?: string;
  startIndex?: number;
  endIndex?: number;
}

/**
 * Type for reasoning content block from LangChain
 */
export interface ReasoningContentBlock {
  type: 'reasoning';
  reasoning: string;
}

/**
 * Type for thinking content block from LangChain (Anthropic-style)
 */
export interface ThinkingContentBlock {
  type: 'thinking';
  thinking: string;
  signature?: string;
}

/**
 * Type for GPT-5 reasoning output block
 */
export interface GPT5ReasoningOutput {
  id: string;
  type: 'reasoning';
  summary: {
    type: 'summary_text';
    text: string;
  }[];
}

/**
 * Type for image generation tool outputs from LangChain/OpenAI
 */
export interface ImageGenerationOutput {
  id: string;
  type: 'image_generation_call';
  status: string;
  result?: string; // base64 image data
  revised_prompt?: string;
  size?: string;
  output_format?: string;
  quality?: string;
  background?: string;
}
