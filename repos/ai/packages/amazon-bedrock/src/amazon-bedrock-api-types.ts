import type { JSONObject } from '@ai-sdk/provider';

export interface AmazonBedrockConverseInput {
  system?: AmazonBedrockSystemMessages;
  messages: AmazonBedrockMessages;
  toolConfig?: AmazonBedrockToolConfiguration;
  inferenceConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
  };
  additionalModelRequestFields?: Record<string, unknown>;
  additionalModelResponseFieldPaths?: string[];
  serviceTier?: {
    type: string;
  };
  guardrailConfig?:
    | AmazonBedrockGuardrailConfiguration
    | AmazonBedrockGuardrailStreamConfiguration
    | undefined;
}

export type AmazonBedrockSystemMessages =
  Array<AmazonBedrockSystemContentBlock>;

export type AmazonBedrockMessages = Array<
  AmazonBedrockAssistantMessage | AmazonBedrockUserMessage
>;

export interface AmazonBedrockAssistantMessage {
  role: 'assistant';
  content: Array<AmazonBedrockContentBlock>;
}

export interface AmazonBedrockUserMessage {
  role: 'user';
  content: Array<AmazonBedrockContentBlock>;
}

/**
 * Cache TTL options for Bedrock prompt caching.
 * @see https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html
 *
 * - '5m': 5-minute TTL (default, supported by all models)
 * - '1h': 1-hour TTL (supported by Claude Opus 4.5, Claude Haiku 4.5, Claude Sonnet 4.5)
 */
export type AmazonBedrockCacheTTL = '5m' | '1h';

export type AmazonBedrockCachePoint = {
  cachePoint: { type: 'default'; ttl?: AmazonBedrockCacheTTL };
};

/**
 * Creates a cache point with an optional TTL.
 * @param ttl - Cache TTL ('5m' or '1h'). If not provided, uses the default 5-minute TTL.
 */
export function createAmazonBedrockCachePoint(
  ttl?: AmazonBedrockCacheTTL,
): AmazonBedrockCachePoint {
  return {
    cachePoint: { type: 'default', ttl },
  };
}

export type AmazonBedrockSystemContentBlock =
  | { text: string }
  | AmazonBedrockCachePoint;

export interface AmazonBedrockGuardrailConfiguration {
  guardrails?: Array<{
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  }>;
}

export type AmazonBedrockGuardrailStreamConfiguration =
  AmazonBedrockGuardrailConfiguration;

export interface AmazonBedrockToolInputSchema {
  json: Record<string, unknown>;
}

export interface AmazonBedrockTool {
  toolSpec: {
    name: string;
    description?: string;
    strict?: boolean;
    inputSchema: { json: JSONObject };
  };
}

export interface AmazonBedrockToolConfiguration {
  tools?: Array<AmazonBedrockTool | AmazonBedrockCachePoint>;
  toolChoice?:
    | { tool: { name: string } }
    | { auto: {} }
    | { any: {} }
    | undefined;
}

export const BEDROCK_STOP_REASONS = [
  'stop',
  'stop_sequence',
  'end_turn',
  'length',
  'max_tokens',
  'content-filter',
  'content_filtered',
  'guardrail_intervened',
  'tool-calls',
  'tool_use',
] as const;

export type AmazonBedrockStopReason = (typeof BEDROCK_STOP_REASONS)[number];

/**
 * @see https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ImageBlock.html
 */
export const BEDROCK_IMAGE_MIME_TYPES = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
} as const;
type AmazonBedrockImageFormats = typeof BEDROCK_IMAGE_MIME_TYPES;
export type AmazonBedrockImageFormat =
  AmazonBedrockImageFormats[keyof AmazonBedrockImageFormats];
export type AmazonBedrockImageMimeType = keyof AmazonBedrockImageFormats;

/**
 * @see https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_DocumentBlock.html
 */
export const BEDROCK_DOCUMENT_MIME_TYPES = {
  'application/pdf': 'pdf',
  'text/csv': 'csv',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/html': 'html',
  'text/plain': 'txt',
  'text/markdown': 'md',
} as const;
type AmazonBedrockDocumentFormats = typeof BEDROCK_DOCUMENT_MIME_TYPES;
export type AmazonBedrockDocumentFormat =
  AmazonBedrockDocumentFormats[keyof AmazonBedrockDocumentFormats];
export type AmazonBedrockDocumentMimeType = keyof AmazonBedrockDocumentFormats;

export interface AmazonBedrockDocumentBlock {
  document: {
    format: AmazonBedrockDocumentFormat;
    name: string;
    source: {
      bytes: string;
    };
    citations?: {
      enabled: boolean;
    };
  };
}

export interface AmazonBedrockGuardrailConverseContentBlock {
  guardContent: unknown;
}

export interface AmazonBedrockImageBlock {
  image: {
    format: AmazonBedrockImageFormat;
    source: {
      bytes: string;
    };
  };
}

export interface AmazonBedrockToolResultBlock {
  toolResult: {
    toolUseId: string;
    content: Array<
      | AmazonBedrockTextBlock
      | AmazonBedrockImageBlock
      | AmazonBedrockDocumentBlock
    >;
  };
}

export interface AmazonBedrockToolUseBlock {
  toolUse: {
    toolUseId: string;
    name: string;
    input: Record<string, unknown>;
  };
}

export interface AmazonBedrockTextBlock {
  text: string;
}

export interface AmazonBedrockReasoningContentBlock {
  reasoningContent: {
    reasoningText: {
      text: string;
      signature?: string;
    };
  };
}

export interface AmazonBedrockRedactedReasoningContentBlock {
  reasoningContent: {
    redactedReasoning: {
      data: string;
    };
  };
}

export type AmazonBedrockContentBlock =
  | AmazonBedrockDocumentBlock
  | AmazonBedrockGuardrailConverseContentBlock
  | AmazonBedrockImageBlock
  | AmazonBedrockTextBlock
  | AmazonBedrockToolResultBlock
  | AmazonBedrockToolUseBlock
  | AmazonBedrockReasoningContentBlock
  | AmazonBedrockRedactedReasoningContentBlock
  | AmazonBedrockCachePoint;
