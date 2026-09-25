import type {
  JSONValue,
  LanguageModelV4FinishReason,
  LanguageModelV4Source,
  LanguageModelV4StreamPart,
  SharedV4ProviderMetadata,
  SharedV4Warning,
} from '@ai-sdk/provider';
import type { ParseResult } from '@ai-sdk/provider-utils';
import type {
  GoogleInteractionsEvent,
  GoogleInteractionsUsage,
} from './google-interactions-api';
import {
  convertGoogleInteractionsUsage,
  getGoogleInteractionsOutputTokensByModality,
} from './convert-google-interactions-usage';
import {
  annotationsToSources,
  builtinToolResultToSources,
} from './extract-google-interactions-sources';
import { mapGoogleInteractionsFinishReason } from './map-google-interactions-finish-reason';
import type {
  GoogleInteractionsAnnotation,
  GoogleInteractionsBuiltinToolResultContent,
  GoogleInteractionsStatus,
} from './google-interactions-prompt';

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

type OpenBlockState =
  | { kind: 'text'; id: string; emittedSourceKeys: Set<string> }
  | {
      kind: 'reasoning';
      id: string;
      signature?: string;
    }
  | {
      kind: 'image';
      id: string;
      data?: string;
      mimeType?: string;
      uri?: string;
    }
  | {
      kind: 'function_call';
      id: string;
      toolCallId: string;
      toolName: string;
      /**
       * Accumulator for partial JSON arguments. Arguments stream as a
       * sequence of `arguments_delta` substrings on `step.delta`; each one is
       * appended verbatim and surfaced as a `tool-input-delta`. On
       * `step.stop` the accumulated string is parsed to recover the full
       * arguments object for the final `tool-call` event.
       */
      argumentsAccum: string;
      signature?: string;
    }
  | {
      kind: 'builtin_tool_call';
      id: string;
      blockType: string;
      toolCallId: string;
      toolName: string;
      arguments: Record<string, unknown>;
      callEmitted: boolean;
    }
  | {
      kind: 'builtin_tool_result';
      id: string;
      blockType: string;
      callId: string;
      toolName: string;
      result: unknown;
      isError?: boolean;
      resultEmitted: boolean;
    }
  /**
   * A `model_output` step whose inner content-block kind has not yet been
   * disambiguated. `step.start` may arrive bare (`{type: 'model_output'}`,
   * no content payload); the first `step.delta` reveals whether the block
   * is text or image. The block opens in this transitional state and swaps
   * to `text` / `image` on the first matching delta.
   */
  | { kind: 'pending_model_output'; id: string }
  | { kind: 'unknown'; id: string };

/**
 * Builds a `TransformStream<ParseResult<GoogleInteractionsEvent>, LanguageModelV4StreamPart>`
 * over the Interactions API SSE event stream.
 *
 * Surfaces text + thought (reasoning), function_call, image, built-in tool
 * call/result steps, and `text_annotation` -> `source` parts.
 */
export function buildGoogleInteractionsStreamTransform({
  warnings,
  generateId,
  includeRawChunks,
  serviceTier: headerServiceTier,
}: {
  warnings: Array<SharedV4Warning>;
  generateId: () => string;
  includeRawChunks?: boolean;
  /**
   * Defensive fallback for service tier read from the `x-gemini-service-tier`
   * HTTP response header. The Interactions API surfaces the applied tier in
   * the `interaction.completed` event body (see `service_tier` below); this
   * parameter exists so we still surface a tier if the API later starts
   * sending the header.
   */
  serviceTier?: string;
}): TransformStream<
  ParseResult<GoogleInteractionsEvent>,
  LanguageModelV4StreamPart
> {
  let interactionId: string | undefined;
  let usage: GoogleInteractionsUsage | undefined;
  let serviceTier: string | undefined = headerServiceTier;
  let finishStatus: GoogleInteractionsStatus | string | undefined;
  let hasFunctionCall = false;

  /*
   * Per-index open step slots. The Interactions API frames concurrent steps
   * (e.g. text alongside thought) by `index`; we track each open slot
   * independently so a text delta at index N never collides with a thought
   * delta at index M.
   */
  const openBlocks = new Map<number, OpenBlockState>();

  /*
   * De-duplicate sources across the whole stream. Citations often re-appear
   * across multiple `text_annotation` deltas as the model's text grows;
   * surface each unique URL once.
   */
  const emittedSourceKeys = new Set<string>();

  function sourceKey(source: LanguageModelV4Source): string {
    return source.sourceType === 'url'
      ? `url:${source.url}`
      : `doc:${source.filename ?? source.title}`;
  }

  return new TransformStream<
    ParseResult<GoogleInteractionsEvent>,
    LanguageModelV4StreamPart
  >({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings });
    },

    transform(chunk, controller) {
      if (includeRawChunks) {
        controller.enqueue({ type: 'raw', rawValue: chunk.rawValue });
      }

      if (!chunk.success) {
        finishStatus = 'failed';
        controller.enqueue({ type: 'error', error: chunk.error });
        return;
      }

      const value = chunk.value;
      const eventType = (value as { event_type?: string }).event_type;

      switch (eventType) {
        case 'interaction.created': {
          const event = value as Extract<
            GoogleInteractionsEvent,
            { event_type: 'interaction.created' }
          >;
          const interaction = event.interaction;
          /*
           * The Interactions API returns `id: ""` (empty string) on streaming
           * events when running with `store: false` — there is no server-side
           * record. Treat empty string the same as missing so providerMetadata
           * stays clean.
           */
          interactionId =
            interaction?.id != null && interaction.id.length > 0
              ? interaction.id
              : undefined;

          const created = (interaction as { created?: string } | undefined)
            ?.created;
          let timestamp: Date | undefined;
          if (typeof created === 'string') {
            const parsed = new Date(created);
            if (!Number.isNaN(parsed.getTime())) {
              timestamp = parsed;
            }
          }

          controller.enqueue({
            type: 'response-metadata',
            ...(interactionId != null ? { id: interactionId } : {}),
            modelId: (interaction as { model?: string } | undefined)?.model,
            ...(timestamp ? { timestamp } : {}),
          });
          break;
        }

        case 'step.start': {
          const event = value as Extract<
            GoogleInteractionsEvent,
            { event_type: 'step.start' }
          >;
          const step = event.step as
            | {
                type?: string;
                id?: string;
                call_id?: string;
                name?: string;
                arguments?: Record<string, unknown>;
                signature?: string;
                summary?: Array<{ type?: string; text?: string }>;
                result?: unknown;
                is_error?: boolean;
                content?: Array<{
                  type?: string;
                  text?: string;
                  data?: string;
                  mime_type?: string;
                  uri?: string;
                  annotations?: Array<GoogleInteractionsAnnotation>;
                }>;
              }
            | undefined;
          const index = event.index;
          const blockId = `${interactionId ?? 'interaction'}:${index}`;
          const stepType = step?.type;

          if (stepType === 'model_output') {
            /*
             * `step.start` for a `model_output` step often carries only the
             * type discriminator — content/image payloads then arrive on
             * subsequent `step.delta` events. Open in a transitional
             * `pending_model_output` state; the first delta promotes it to
             * either `text` (and emits `text-start`) or `image`.
             *
             * `step.content[0]` may also arrive populated as a hint; when
             * present, promote eagerly.
             */
            const initial = step?.content?.[0] as
              | {
                  type?: string;
                  text?: string;
                  data?: string;
                  mime_type?: string;
                  uri?: string;
                  annotations?: Array<GoogleInteractionsAnnotation>;
                }
              | undefined;
            if (initial?.type === 'text') {
              openBlocks.set(index, {
                kind: 'text',
                id: blockId,
                emittedSourceKeys: new Set<string>(),
              });
              controller.enqueue({ type: 'text-start', id: blockId });

              const initialSources = annotationsToSources({
                annotations: initial.annotations,
                generateId,
              });
              for (const source of initialSources) {
                const key = sourceKey(source);
                if (emittedSourceKeys.has(key)) continue;
                emittedSourceKeys.add(key);
                controller.enqueue(source);
              }
            } else if (initial?.type === 'image') {
              openBlocks.set(index, {
                kind: 'image',
                id: blockId,
                ...(initial.data != null ? { data: initial.data } : {}),
                ...(initial.mime_type != null
                  ? { mimeType: initial.mime_type }
                  : {}),
                ...(initial.uri != null ? { uri: initial.uri } : {}),
              });
            } else {
              openBlocks.set(index, {
                kind: 'pending_model_output',
                id: blockId,
              });
            }
          } else if (stepType === 'thought') {
            const signature = step?.signature;
            openBlocks.set(index, {
              kind: 'reasoning',
              id: blockId,
              ...(signature != null ? { signature } : {}),
            });
            controller.enqueue({ type: 'reasoning-start', id: blockId });
            /*
             * A `thought` step's initial `summary[]` may already contain text
             * items on `step.start` — emit those as reasoning deltas so the
             * consumer's reasoning buffer is up to date before any delta
             * arrives.
             */
            if (Array.isArray(step?.summary)) {
              for (const item of step.summary) {
                if (item?.type === 'text' && typeof item.text === 'string') {
                  controller.enqueue({
                    type: 'reasoning-delta',
                    id: blockId,
                    delta: item.text,
                  });
                }
              }
            }
          } else if (stepType === 'function_call') {
            const toolCallId = step?.id ?? blockId;
            const toolName = step?.name ?? 'unknown';
            hasFunctionCall = true;
            const state: Extract<OpenBlockState, { kind: 'function_call' }> = {
              kind: 'function_call',
              id: blockId,
              toolCallId,
              toolName,
              argumentsAccum: '',
              ...(step?.signature != null ? { signature: step.signature } : {}),
            };
            openBlocks.set(index, state);
            controller.enqueue({
              type: 'tool-input-start',
              id: toolCallId,
              toolName,
            });
          } else if (
            stepType != null &&
            BUILTIN_TOOL_CALL_TYPES.has(stepType)
          ) {
            const toolName =
              stepType === 'mcp_server_tool_call'
                ? (step?.name ?? 'mcp_server_tool')
                : builtinToolNameFromCallType(stepType);
            const toolCallId = step?.id ?? blockId;
            const state: Extract<
              OpenBlockState,
              { kind: 'builtin_tool_call' }
            > = {
              kind: 'builtin_tool_call',
              id: blockId,
              blockType: stepType,
              toolCallId,
              toolName,
              arguments: step?.arguments ?? {},
              callEmitted: false,
            };
            openBlocks.set(index, state);
          } else if (
            stepType != null &&
            BUILTIN_TOOL_RESULT_TYPES.has(stepType)
          ) {
            const toolName =
              stepType === 'mcp_server_tool_result'
                ? (step?.name ?? 'mcp_server_tool')
                : builtinToolNameFromResultType(stepType);
            const callId = step?.call_id ?? blockId;
            const state: Extract<
              OpenBlockState,
              { kind: 'builtin_tool_result' }
            > = {
              kind: 'builtin_tool_result',
              id: blockId,
              blockType: stepType,
              callId,
              toolName,
              result: step?.result ?? null,
              ...(step?.is_error != null ? { isError: step.is_error } : {}),
              resultEmitted: false,
            };
            openBlocks.set(index, state);
          } else {
            openBlocks.set(index, { kind: 'unknown', id: blockId });
          }
          break;
        }

        case 'step.delta': {
          const event = value as Extract<
            GoogleInteractionsEvent,
            { event_type: 'step.delta' }
          >;
          let open = openBlocks.get(event.index);
          if (open == null) break;

          const dtype = (event.delta as { type?: string } | undefined)?.type;

          /*
           * Promote a pending model_output block to `text` on the first
           * text-shaped delta. Image deltas are emitted inline below — a
           * model_output step can interleave text and image deltas, so the
           * text "open block" stays in place across image emissions instead
           * of being swapped for an image state.
           */
          if (open.kind === 'pending_model_output') {
            if (
              dtype === 'text' ||
              dtype === 'text_annotation' ||
              dtype === 'text_annotation_delta'
            ) {
              const promoted: Extract<OpenBlockState, { kind: 'text' }> = {
                kind: 'text',
                id: open.id,
                emittedSourceKeys: new Set<string>(),
              };
              openBlocks.set(event.index, promoted);
              open = promoted;
              controller.enqueue({ type: 'text-start', id: promoted.id });
            }
          }

          /*
           * Image deltas inside `model_output` carry the full payload in a
           * single chunk (no per-byte streaming). Emit the `file` part as
           * soon as the delta arrives so it surfaces regardless of whether
           * a text block is currently open at the same index.
           */
          if (
            dtype === 'image' &&
            (open.kind === 'pending_model_output' ||
              open.kind === 'text' ||
              open.kind === 'image')
          ) {
            const imageDelta = event.delta as
              | { data?: string; mime_type?: string; uri?: string }
              | undefined;
            const google: Record<string, string> = {};
            if (interactionId != null) google.interactionId = interactionId;
            const providerMetadata =
              Object.keys(google).length > 0 ? { google } : undefined;
            if (imageDelta?.data != null && imageDelta.data.length > 0) {
              controller.enqueue({
                type: 'file',
                mediaType: imageDelta.mime_type ?? 'image/png',
                data: { type: 'data', data: imageDelta.data },
                ...(providerMetadata ? { providerMetadata } : {}),
              });
            } else if (imageDelta?.uri != null && imageDelta.uri.length > 0) {
              controller.enqueue({
                type: 'file',
                mediaType: imageDelta.mime_type ?? 'image/png',
                data: { type: 'url', url: new URL(imageDelta.uri) },
                ...(providerMetadata ? { providerMetadata } : {}),
              });
            }
            // The file part was emitted inline; clear any data on an
            // eagerly-promoted image OpenBlockState so the `step.stop`
            // handler does not emit a duplicate.
            if (open.kind === 'image') {
              open.data = undefined;
              open.uri = undefined;
            }
            break;
          }

          /*
           * `video` deltas inside `model_output` carry the full payload in a
           * single chunk (no per-byte streaming), mirroring `image`. Emit the
           * `file` part as soon as the delta arrives so it surfaces regardless
           * of whether a text block is currently open at the same index.
           */
          if (
            dtype === 'video' &&
            (open.kind === 'pending_model_output' || open.kind === 'text')
          ) {
            const videoDelta = event.delta as
              | { data?: string; mime_type?: string; uri?: string }
              | undefined;
            const google: Record<string, string> = {};
            if (interactionId != null) google.interactionId = interactionId;
            const providerMetadata =
              Object.keys(google).length > 0 ? { google } : undefined;
            if (videoDelta?.data != null && videoDelta.data.length > 0) {
              controller.enqueue({
                type: 'file',
                mediaType: videoDelta.mime_type ?? 'video/mp4',
                data: { type: 'data', data: videoDelta.data },
                ...(providerMetadata ? { providerMetadata } : {}),
              });
            } else if (videoDelta?.uri != null && videoDelta.uri.length > 0) {
              controller.enqueue({
                type: 'file',
                mediaType: videoDelta.mime_type ?? 'video/mp4',
                data: { type: 'url', url: new URL(videoDelta.uri) },
                ...(providerMetadata ? { providerMetadata } : {}),
              });
            }
            break;
          }

          const delta = event.delta as
            | {
                type?: string;
                text?: string;
                signature?: string;
                content?: { type?: string; text?: string };
                id?: string;
                /*
                 * `arguments` carries different shapes per delta kind:
                 * - `type: 'arguments_delta'` → `string` (partial JSON)
                 * - `type: '<builtin>_tool_call'` → `Record<string, unknown>`
                 * The branch handler reads it with the matching type.
                 */
                arguments?: Record<string, unknown> | string;
                annotations?: Array<GoogleInteractionsAnnotation>;
                call_id?: string;
                result?: unknown;
                is_error?: boolean;
                data?: string;
                mime_type?: string;
                uri?: string;
                name?: string;
              }
            | undefined;

          if (open.kind === 'text' && delta?.type === 'text') {
            const text = delta.text ?? '';
            if (text.length > 0) {
              controller.enqueue({
                type: 'text-delta',
                id: open.id,
                delta: text,
              });
            }
          } else if (
            open.kind === 'text' &&
            (delta?.type === 'text_annotation' ||
              delta?.type === 'text_annotation_delta')
          ) {
            const sources = annotationsToSources({
              annotations: delta.annotations,
              generateId,
            });
            for (const source of sources) {
              const key = sourceKey(source);
              if (emittedSourceKeys.has(key)) continue;
              emittedSourceKeys.add(key);
              open.emittedSourceKeys.add(key);
              controller.enqueue(source);
            }
          } else if (open.kind === 'image' && delta?.type === 'image') {
            if (delta.data != null) open.data = delta.data;
            if (delta.mime_type != null) open.mimeType = delta.mime_type;
            if (delta.uri != null) open.uri = delta.uri;
          } else if (open.kind === 'reasoning') {
            if (delta?.type === 'thought_summary') {
              const item = delta.content;
              if (item?.type === 'text' && typeof item.text === 'string') {
                controller.enqueue({
                  type: 'reasoning-delta',
                  id: open.id,
                  delta: item.text,
                });
              }
            } else if (delta?.type === 'thought_signature') {
              const signature = delta.signature;
              if (signature != null) {
                open.signature = signature;
              }
            }
          } else if (
            open.kind === 'function_call' &&
            delta?.type === 'arguments_delta'
          ) {
            /*
             * Partial JSON arguments arrive as `arguments_delta` events.
             * The partial JSON string lives in `delta.arguments` (a string,
             * not the parsed object — the `arguments_delta` name applies to
             * the discriminator only). Append to the accumulator and surface
             * each chunk as a `tool-input-delta`; the full arguments object
             * is emitted at `step.stop`.
             */
            const slice =
              typeof delta.arguments === 'string' ? delta.arguments : '';
            if (slice.length > 0) {
              open.argumentsAccum += slice;
              controller.enqueue({
                type: 'tool-input-delta',
                id: open.toolCallId,
                delta: slice,
              });
            }
            if (delta.id != null) {
              open.toolCallId = delta.id;
            }
            if (delta.signature != null) {
              open.signature = delta.signature;
            }
            hasFunctionCall = true;
          } else if (
            open.kind === 'builtin_tool_call' &&
            delta?.type === open.blockType
          ) {
            if (delta.id != null) open.toolCallId = delta.id;
            if (
              delta.arguments != null &&
              typeof delta.arguments === 'object'
            ) {
              open.arguments = delta.arguments;
            }
            if (
              delta.name != null &&
              open.blockType === 'mcp_server_tool_call'
            ) {
              open.toolName = delta.name;
            }
          } else if (
            open.kind === 'builtin_tool_result' &&
            delta?.type === open.blockType
          ) {
            if (delta.call_id != null) open.callId = delta.call_id;
            if (delta.result !== undefined) open.result = delta.result;
            if (delta.is_error != null) open.isError = delta.is_error;
            if (
              delta.name != null &&
              open.blockType === 'mcp_server_tool_result'
            ) {
              open.toolName = delta.name;
            }
          }
          break;
        }

        case 'step.stop': {
          const event = value as Extract<
            GoogleInteractionsEvent,
            { event_type: 'step.stop' }
          >;
          const open = openBlocks.get(event.index);
          if (open == null) break;

          if (open.kind === 'text') {
            const textProviderMetadata =
              interactionId != null ? { google: { interactionId } } : undefined;
            controller.enqueue({
              type: 'text-end',
              id: open.id,
              ...(textProviderMetadata
                ? { providerMetadata: textProviderMetadata }
                : {}),
            });
          } else if (open.kind === 'reasoning') {
            const google: Record<string, string> = {};
            if (open.signature != null) google.signature = open.signature;
            if (interactionId != null) google.interactionId = interactionId;
            const providerMetadata =
              Object.keys(google).length > 0 ? { google } : undefined;
            controller.enqueue({
              type: 'reasoning-end',
              id: open.id,
              ...(providerMetadata ? { providerMetadata } : {}),
            });
          } else if (open.kind === 'image') {
            const google: Record<string, string> = {};
            if (interactionId != null) google.interactionId = interactionId;
            const providerMetadata =
              Object.keys(google).length > 0 ? { google } : undefined;
            if (open.data != null && open.data.length > 0) {
              controller.enqueue({
                type: 'file',
                mediaType: open.mimeType ?? 'image/png',
                data: { type: 'data', data: open.data },
                ...(providerMetadata ? { providerMetadata } : {}),
              });
            } else if (open.uri != null && open.uri.length > 0) {
              controller.enqueue({
                type: 'file',
                mediaType: open.mimeType ?? 'image/png',
                data: { type: 'url', url: new URL(open.uri) },
                ...(providerMetadata ? { providerMetadata } : {}),
              });
            }
          } else if (open.kind === 'function_call') {
            const accumulated =
              open.argumentsAccum.length > 0 ? open.argumentsAccum : '{}';
            controller.enqueue({
              type: 'tool-input-end',
              id: open.toolCallId,
            });
            const google: Record<string, string> = {};
            if (open.signature != null) google.signature = open.signature;
            if (interactionId != null) google.interactionId = interactionId;
            const providerMetadata =
              Object.keys(google).length > 0 ? { google } : undefined;
            controller.enqueue({
              type: 'tool-call',
              toolCallId: open.toolCallId,
              toolName: open.toolName,
              input: accumulated,
              ...(providerMetadata ? { providerMetadata } : {}),
            });
          } else if (open.kind === 'builtin_tool_call' && !open.callEmitted) {
            controller.enqueue({
              type: 'tool-call',
              toolCallId: open.toolCallId,
              toolName: open.toolName,
              input: JSON.stringify(open.arguments ?? {}),
              providerExecuted: true,
            });
            open.callEmitted = true;
          } else if (
            open.kind === 'builtin_tool_result' &&
            !open.resultEmitted
          ) {
            controller.enqueue({
              type: 'tool-result',
              toolCallId: open.callId,
              toolName: open.toolName,
              result: (open.result ?? null) as NonNullable<JSONValue>,
            });
            open.resultEmitted = true;

            const sources = builtinToolResultToSources({
              block: {
                type: open.blockType,
                call_id: open.callId,
                result: open.result,
              } as unknown as GoogleInteractionsBuiltinToolResultContent,
              generateId,
            });
            for (const source of sources) {
              const key = sourceKey(source);
              if (emittedSourceKeys.has(key)) continue;
              emittedSourceKeys.add(key);
              controller.enqueue(source);
            }
          }
          openBlocks.delete(event.index);
          break;
        }

        case 'interaction.status_update':
        case 'interaction.in_progress':
        case 'interaction.requires_action': {
          const event = value as Extract<
            GoogleInteractionsEvent,
            {
              event_type:
                | 'interaction.status_update'
                | 'interaction.in_progress'
                | 'interaction.requires_action';
            }
          >;
          if (event.status != null) {
            finishStatus = event.status;
          } else if (eventType === 'interaction.requires_action') {
            finishStatus = 'requires_action';
          } else {
            finishStatus = 'in_progress';
          }
          break;
        }

        case 'interaction.completed': {
          const event = value as Extract<
            GoogleInteractionsEvent,
            { event_type: 'interaction.completed' }
          >;
          const interaction = event.interaction as {
            id?: string;
            status?: GoogleInteractionsStatus;
            usage?: GoogleInteractionsUsage;
            service_tier?: string;
          };
          if (interaction?.id != null && interaction.id.length > 0) {
            interactionId = interaction.id;
          }
          if (interaction?.status != null) {
            finishStatus = interaction.status;
          }
          if (interaction?.usage != null) {
            usage = interaction.usage;
          }
          /*
           * The Interactions API surfaces the applied service tier on
           * `interaction.completed.interaction.service_tier` (NOT on the
           * `x-gemini-service-tier` HTTP header that `:generateContent`
           * uses). Body wins over header fallback.
           */
          if (interaction?.service_tier != null) {
            serviceTier = interaction.service_tier;
          }
          break;
        }

        case 'error': {
          const event = value as Extract<
            GoogleInteractionsEvent,
            { event_type: 'error' }
          >;
          finishStatus = 'failed';
          const errorPayload = event.error ?? {
            message: 'Unknown interaction error',
          };
          controller.enqueue({ type: 'error', error: errorPayload });
          break;
        }

        default:
          break;
      }
    },

    flush(controller) {
      const finishReason: LanguageModelV4FinishReason = {
        unified: mapGoogleInteractionsFinishReason({
          status: finishStatus,
          hasFunctionCall,
        }),
        raw: finishStatus,
      };

      const outputTokensByModality =
        getGoogleInteractionsOutputTokensByModality(usage);

      const providerMetadata: SharedV4ProviderMetadata = {
        google: {
          ...(interactionId != null ? { interactionId } : {}),
          ...(serviceTier != null ? { serviceTier } : {}),
          ...(outputTokensByModality != null ? { outputTokensByModality } : {}),
        },
      };

      controller.enqueue({
        type: 'finish',
        finishReason,
        usage: convertGoogleInteractionsUsage(usage),
        providerMetadata,
      });
    },
  });
}
