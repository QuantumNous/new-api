import type {
  LanguageModelV4CallOptions,
  LanguageModelV4Prompt,
} from '@ai-sdk/provider';
import {
  experimental_streamLanguageModelCall as streamModelCall,
  gateway,
  type Experimental_LanguageModelStreamPart as ModelCallStreamPart,
  type FinishReason,
  type LanguageModel,
  type LanguageModelUsage,
  type ModelMessage,
  type StopCondition,
  type ToolCallRepairFunction,
  type ToolChoice,
  type ToolSet,
} from 'ai';
import type { ProviderOptions } from './workflow-agent.js';
import {
  resolveSerializableTools,
  type SerializableToolDef,
} from './serializable-schema.js';
export type { Experimental_LanguageModelStreamPart as ModelCallStreamPart } from 'ai';

export type ModelStopCondition = StopCondition<NoInfer<ToolSet>, any>;

/**
 * Provider-executed tool result captured from the stream.
 */
export interface ProviderExecutedToolResult {
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError?: boolean;
}

/**
 * Options for the doStreamStep function.
 */
export interface DoStreamStepOptions {
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stopSequences?: string[];
  seed?: number;
  maxRetries?: number;
  abortSignal?: AbortSignal;
  headers?: Record<string, string | undefined>;
  reasoning?: LanguageModelV4CallOptions['reasoning'];
  providerOptions?: ProviderOptions;
  toolChoice?: ToolChoice<ToolSet>;
  includeRawChunks?: boolean;
  repairToolCall?: ToolCallRepairFunction<ToolSet>;
  responseFormat?: LanguageModelV4CallOptions['responseFormat'];
}

/**
 * Parsed tool call from the stream (parsed by streamModelCall's transform).
 */
export interface ParsedToolCall {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  input: unknown;
  providerExecuted?: boolean;
  providerMetadata?: Record<string, unknown>;
  dynamic?: boolean;
  invalid?: boolean;
  error?: unknown;
}

/**
 * Finish metadata from the stream.
 */
export interface StreamFinish {
  finishReason: FinishReason;
  rawFinishReason: string | undefined;
  usage: LanguageModelUsage;
  providerMetadata?: Record<string, unknown>;
}

/**
 * Minimal aggregates needed to reconstruct a `StepResult` outside the step
 * boundary. By returning only these fields (instead of a fully-populated
 * StepResult plus the raw `chunks[]` array), the durable event log doesn't
 * carry StepResult's redundant copies — `content`, the duplicate
 * `toolCalls`/`dynamicToolCalls` lists, `reasoningText`, the always-empty
 * `*ToolResults` arrays, and the per-chunk `chunks[]` snapshot the iterator
 * never reads. The caller reconstructs the full StepResult via
 * `buildStepResult`.
 */
export interface DoStreamStepRawResult {
  text: string;
  reasoning: Array<{ text: string }>;
  responseMetadata?: { id?: string; timestamp?: Date; modelId?: string };
  warnings?: unknown[];
}

export async function doStreamStep(
  conversationPrompt: LanguageModelV4Prompt,
  modelInit: LanguageModel,
  writable?: WritableStream<ModelCallStreamPart<ToolSet>>,
  serializedTools?: Record<string, SerializableToolDef>,
  options?: DoStreamStepOptions,
): Promise<{
  toolCalls: ParsedToolCall[];
  finish: StreamFinish | undefined;
  raw: DoStreamStepRawResult;
  providerExecutedToolResults: Map<string, ProviderExecutedToolResult>;
}> {
  'use step';

  // Resolve model inside step (must happen here for serialization boundary)
  const model: LanguageModel =
    typeof modelInit === 'string'
      ? gateway.languageModel(modelInit)
      : modelInit;

  // Reconstruct tools from serializable definitions with Ajv validation.
  // Tools are serialized before crossing the step boundary because zod schemas
  // contain functions that can't be serialized by the workflow runtime.
  const tools = serializedTools
    ? resolveSerializableTools(serializedTools)
    : undefined;

  // streamModelCall handles: prompt standardization, tool preparation,
  // model.doStream(), retry logic, and stream part transformation
  // (tool call parsing, finish reason mapping, file wrapping).
  const { stream: modelStream } = await streamModelCall({
    model,
    // streamModelCall expects Prompt (ModelMessage[]) but we pass the
    // pre-converted LanguageModelV4Prompt. standardizePrompt inside
    // streamModelCall handles both formats.
    messages: conversationPrompt as unknown as ModelMessage[],
    allowSystemInMessages: true,
    tools,
    toolChoice: options?.toolChoice,
    includeRawChunks: options?.includeRawChunks,
    providerOptions: options?.providerOptions,
    abortSignal: options?.abortSignal,
    headers: options?.headers,
    reasoning: options?.reasoning,
    maxOutputTokens: options?.maxOutputTokens,
    temperature: options?.temperature,
    topP: options?.topP,
    topK: options?.topK,
    presencePenalty: options?.presencePenalty,
    frequencyPenalty: options?.frequencyPenalty,
    stopSequences: options?.stopSequences,
    seed: options?.seed,
    repairToolCall: options?.repairToolCall,
  });

  // Consume the stream: capture data and write to writable in real-time
  const toolCalls: ParsedToolCall[] = [];
  const providerExecutedToolResults = new Map<
    string,
    ProviderExecutedToolResult
  >();
  let finish: StreamFinish | undefined;

  // Minimal aggregation — only what buildStepResult needs outside the step.
  let text = '';
  const reasoningParts: Array<{ text: string }> = [];
  let responseMetadata:
    | { id?: string; timestamp?: Date; modelId?: string }
    | undefined;
  let warnings: unknown[] | undefined;

  // Acquire writer once before the loop to avoid per-chunk lock overhead
  const writer = writable?.getWriter();

  try {
    for await (const part of modelStream) {
      switch (part.type) {
        case 'text-delta':
          text += part.text;
          break;
        case 'reasoning-delta':
          reasoningParts.push({ text: part.text });
          break;
        case 'tool-call': {
          // parseToolCall adds dynamic/invalid/error at runtime
          const toolCallPart = part as typeof part & Partial<ParsedToolCall>;
          toolCalls.push({
            type: 'tool-call',
            toolCallId: toolCallPart.toolCallId,
            toolName: toolCallPart.toolName,
            input: toolCallPart.input,
            providerExecuted: toolCallPart.providerExecuted,
            providerMetadata: toolCallPart.providerMetadata as
              | Record<string, unknown>
              | undefined,
            dynamic: toolCallPart.dynamic,
            invalid: toolCallPart.invalid,
            error: toolCallPart.error,
          });
          break;
        }
        case 'tool-result':
          if (part.providerExecuted) {
            providerExecutedToolResults.set(part.toolCallId, {
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              result: part.output,
              isError: false,
            });
          }
          break;
        case 'tool-error': {
          const errorPart = part as typeof part & {
            providerExecuted?: boolean;
          };
          if (errorPart.providerExecuted) {
            providerExecutedToolResults.set(errorPart.toolCallId, {
              toolCallId: errorPart.toolCallId,
              toolName: errorPart.toolName,
              result: errorPart.error,
              isError: true,
            });
          }
          break;
        }
        case 'model-call-end':
          finish = {
            finishReason: part.finishReason,
            rawFinishReason: part.rawFinishReason,
            usage: part.usage,
            providerMetadata: part.providerMetadata as
              | Record<string, unknown>
              | undefined,
          };
          break;
        case 'model-call-start':
          warnings = part.warnings;
          break;
        case 'model-call-response-metadata':
          responseMetadata = part;
          break;
      }

      // Write to writable in real-time
      if (writer) {
        await writer.write(part);
      }
    }
  } finally {
    writer?.releaseLock();
  }

  return {
    toolCalls,
    finish,
    raw: {
      text,
      reasoning: reasoningParts,
      responseMetadata,
      warnings,
    },
    providerExecutedToolResults,
  };
}
