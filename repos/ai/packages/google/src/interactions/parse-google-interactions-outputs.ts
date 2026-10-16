import type { JSONValue, LanguageModelV4Content } from '@ai-sdk/provider';
import type { GoogleInteractionsStep } from './google-interactions-api';
import {
  annotationsToSources,
  builtinToolResultToSources,
} from './extract-google-interactions-sources';
import type {
  GoogleInteractionsAnnotation,
  GoogleInteractionsBuiltinToolResultContent,
} from './google-interactions-prompt';

export type ParseGoogleInteractionsOutputsResult = {
  content: Array<LanguageModelV4Content>;
  hasFunctionCall: boolean;
};

/*
 * Builds a `providerMetadata.google` payload for an output part so the
 * Interactions converter on the next turn can read both the per-step
 * `signature` (round-trip) and the parent `interactionId` (history compaction
 * under `previousInteractionId`).
 */
function googleProviderMetadata({
  signature,
  interactionId,
}: {
  signature?: string | null;
  interactionId?: string;
}): { providerMetadata: { google: Record<string, string> } } | object {
  const google: Record<string, string> = {};
  if (signature != null) {
    google.signature = signature;
  }
  if (interactionId != null) {
    google.interactionId = interactionId;
  }
  return Object.keys(google).length > 0 ? { providerMetadata: { google } } : {};
}

const BUILTIN_TOOL_CALL_TYPES = new Set([
  'google_search_call',
  'code_execution_call',
  'url_context_call',
  'file_search_call',
  'google_maps_call',
  'mcp_server_tool_call',
]);

const BUILTIN_TOOL_RESULT_TYPES = new Set([
  'google_search_result',
  'code_execution_result',
  'url_context_result',
  'file_search_result',
  'google_maps_result',
  'mcp_server_tool_result',
]);

function builtinToolNameFromCallType(type: string): string {
  return type.replace(/_call$/, '');
}

function builtinToolNameFromResultType(type: string): string {
  return type.replace(/_result$/, '');
}

/**
 * Walks the `steps[]` array of an Interactions response and emits AI SDK
 * `LanguageModelV4Content[]`. Surfaces:
 *
 * - `model_output` steps: iterates `step.content[]` for `text` (with
 *   annotations → source parts) and `image` content blocks.
 * - `thought` steps: emits a single `reasoning` part from `summary[*]`.
 * - `function_call` steps: emits a `tool-call` part directly.
 * - Built-in tool `*_call` / `*_result` steps (Google Search, Code Execution,
 *   URL Context, File Search, Google Maps, MCP Server): emits
 *   `tool-call`/`tool-result` parts with `providerExecuted: true`.
 * - `user_input` steps are skipped (they echo the client's input).
 */
export function parseGoogleInteractionsOutputs({
  steps,
  generateId,
  interactionId,
}: {
  steps: Array<GoogleInteractionsStep> | null | undefined;
  generateId: () => string;
  /**
   * Top-level `Interaction.id` on the response. Stamped onto each output
   * part's `providerMetadata.google.interactionId` so the converter can drop
   * matching assistant turns when `previousInteractionId` is used on the
   * next turn (compaction).
   */
  interactionId?: string;
}): ParseGoogleInteractionsOutputsResult {
  const content: Array<LanguageModelV4Content> = [];
  let hasFunctionCall = false;

  if (steps == null) {
    return { content, hasFunctionCall };
  }

  for (const step of steps) {
    if (step == null || typeof step !== 'object') continue;
    const type = (step as { type?: string }).type;
    if (typeof type !== 'string') continue;

    switch (type) {
      case 'user_input': {
        break;
      }
      case 'model_output': {
        const blocks =
          (step as { content?: Array<{ type?: string; [k: string]: unknown }> })
            .content ?? [];
        for (const block of blocks) {
          if (block == null || typeof block !== 'object') continue;
          const blockType = block.type;
          if (blockType === 'text') {
            const text = (block as { text?: string }).text ?? '';
            const annotations = (
              block as {
                annotations?: Array<GoogleInteractionsAnnotation>;
              }
            ).annotations;
            content.push({
              type: 'text',
              text,
              ...googleProviderMetadata({ interactionId }),
            });
            const sources = annotationsToSources({ annotations, generateId });
            for (const source of sources) {
              content.push(source);
            }
          } else if (blockType === 'image') {
            const image = block as {
              data?: string;
              mime_type?: string;
              uri?: string;
            };
            if (image.data != null && image.data.length > 0) {
              content.push({
                type: 'file',
                mediaType: image.mime_type ?? 'image/png',
                data: { type: 'data', data: image.data },
                ...googleProviderMetadata({ interactionId }),
              });
            } else if (image.uri != null && image.uri.length > 0) {
              content.push({
                type: 'file',
                mediaType: image.mime_type ?? 'image/png',
                data: { type: 'url', url: new URL(image.uri) },
                ...googleProviderMetadata({ interactionId }),
              });
            }
          } else if (blockType === 'video') {
            const video = block as {
              data?: string;
              mime_type?: string;
              uri?: string;
            };
            if (video.data != null && video.data.length > 0) {
              content.push({
                type: 'file',
                mediaType: video.mime_type ?? 'video/mp4',
                data: { type: 'data', data: video.data },
                ...googleProviderMetadata({ interactionId }),
              });
            } else if (video.uri != null && video.uri.length > 0) {
              content.push({
                type: 'file',
                mediaType: video.mime_type ?? 'video/mp4',
                data: { type: 'url', url: new URL(video.uri) },
                ...googleProviderMetadata({ interactionId }),
              });
            }
          }
        }
        break;
      }
      case 'thought': {
        const thought = step as {
          signature?: string;
          summary?: Array<{ type: string; text?: string }>;
        };
        const summary = Array.isArray(thought.summary) ? thought.summary : [];
        const text = summary
          .filter(
            item => item?.type === 'text' && typeof item.text === 'string',
          )
          .map(item => item.text as string)
          .join('\n');
        content.push({
          type: 'reasoning',
          text,
          ...googleProviderMetadata({
            signature: thought.signature,
            interactionId,
          }),
        });
        break;
      }
      case 'function_call': {
        hasFunctionCall = true;
        const call = step as {
          id: string;
          name: string;
          arguments?: Record<string, unknown> | null;
          signature?: string | null;
        };
        content.push({
          type: 'tool-call',
          toolCallId: call.id,
          toolName: call.name,
          input: JSON.stringify(call.arguments ?? {}),
          ...googleProviderMetadata({
            signature: call.signature,
            interactionId,
          }),
        });
        break;
      }
      default: {
        if (BUILTIN_TOOL_CALL_TYPES.has(type)) {
          const call = step as {
            id?: string;
            arguments?: Record<string, unknown>;
            name?: string;
            server_name?: string;
          };
          const toolName =
            type === 'mcp_server_tool_call'
              ? (call.name ?? 'mcp_server_tool')
              : builtinToolNameFromCallType(type);
          const input = JSON.stringify(call.arguments ?? {});
          content.push({
            type: 'tool-call',
            toolCallId: call.id ?? generateId(),
            toolName,
            input,
            providerExecuted: true,
          });
        } else if (BUILTIN_TOOL_RESULT_TYPES.has(type)) {
          const result = step as {
            call_id?: string;
            result?: unknown;
            is_error?: boolean;
            name?: string;
          };
          const toolName =
            type === 'mcp_server_tool_result'
              ? (result.name ?? 'mcp_server_tool')
              : builtinToolNameFromResultType(type);
          content.push({
            type: 'tool-result',
            toolCallId: result.call_id ?? generateId(),
            toolName,
            result: (result.result ?? null) as NonNullable<JSONValue>,
          });
          const sources = builtinToolResultToSources({
            block:
              step as unknown as GoogleInteractionsBuiltinToolResultContent,
            generateId,
          });
          for (const source of sources) {
            content.push(source);
          }
        }
        break;
      }
    }
  }

  return { content, hasFunctionCall };
}
