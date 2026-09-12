import {
  lazySchema,
  zodSchema,
  type InferSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

/*
 * Zod schemas for the Gemini Interactions API wire format.
 *
 * Helpers are defined as factories (invoked only inside the exported
 * `lazySchema(() => ...)` callbacks) so no `z.object(...)` / `z.union(...)`
 * runs at module import. Schemas are intentionally narrow on the fields the
 * SDK consumes and lenient (`loose()` / `unknown`) on the rest, so subsequent
 * additions can widen without breaking the basic path.
 */

const tokenByModalitySchema = () =>
  z
    .object({
      modality: z.string().nullish(),
      tokens: z.number().nullish(),
    })
    .loose();

const usageSchema = () =>
  z
    .object({
      total_input_tokens: z.number().nullish(),
      total_output_tokens: z.number().nullish(),
      total_thought_tokens: z.number().nullish(),
      total_cached_tokens: z.number().nullish(),
      total_tool_use_tokens: z.number().nullish(),
      total_tokens: z.number().nullish(),
      input_tokens_by_modality: z.array(tokenByModalitySchema()).nullish(),
      output_tokens_by_modality: z.array(tokenByModalitySchema()).nullish(),
      cached_tokens_by_modality: z.array(tokenByModalitySchema()).nullish(),
      tool_use_tokens_by_modality: z.array(tokenByModalitySchema()).nullish(),
      grounding_tool_count: z
        .array(
          z
            .object({
              type: z.string().nullish(),
              count: z.number().nullish(),
            })
            .loose(),
        )
        .nullish(),
    })
    .loose();

export type GoogleInteractionsUsage = z.infer<ReturnType<typeof usageSchema>>;

const interactionStatusSchema = () =>
  z.enum([
    'in_progress',
    'requires_action',
    'completed',
    'failed',
    'cancelled',
    'incomplete',
  ]);

const annotationSchema = () => {
  const urlCitation = z
    .object({
      type: z.literal('url_citation'),
      url: z.string().nullish(),
      title: z.string().nullish(),
      start_index: z.number().nullish(),
      end_index: z.number().nullish(),
    })
    .loose();

  const fileCitation = z
    .object({
      type: z.literal('file_citation'),
      file_name: z.string().nullish(),
      document_uri: z.string().nullish(),
      url: z.string().nullish(),
      page_number: z.number().nullish(),
      media_id: z.string().nullish(),
      start_index: z.number().nullish(),
      end_index: z.number().nullish(),
      custom_metadata: z.record(z.string(), z.unknown()).nullish(),
    })
    .loose();

  const placeCitation = z
    .object({
      type: z.literal('place_citation'),
      name: z.string().nullish(),
      url: z.string().nullish(),
      place_id: z.string().nullish(),
      start_index: z.number().nullish(),
      end_index: z.number().nullish(),
    })
    .loose();

  return z.union([
    urlCitation,
    fileCitation,
    placeCitation,
    z.object({ type: z.string() }).loose(),
  ]);
};

const thoughtSummaryItemSchema = () =>
  z
    .object({
      type: z.string(),
      text: z.string().nullish(),
      data: z.string().nullish(),
      mime_type: z.string().nullish(),
    })
    .loose();

/*
 * Content block schemas — these populate the `content` array of a
 * `model_output` step. Function calls, thoughts, and built-in tool
 * call/result blocks are top-level step types (see `stepSchema` below), not
 * content blocks.
 */
const contentBlockSchema = () => {
  const textContent = z
    .object({
      type: z.literal('text'),
      text: z.string(),
      annotations: z.array(annotationSchema()).nullish(),
    })
    .loose();

  const imageContent = z
    .object({
      type: z.literal('image'),
      data: z.string().nullish(),
      mime_type: z.string().nullish(),
      resolution: z.enum(['low', 'medium', 'high', 'ultra_high']).nullish(),
      uri: z.string().nullish(),
    })
    .loose();

  const videoContent = z
    .object({
      type: z.literal('video'),
      data: z.string().nullish(),
      mime_type: z.string().nullish(),
      uri: z.string().nullish(),
    })
    .loose();

  return z.union([
    textContent,
    imageContent,
    videoContent,
    z.object({ type: z.string() }).loose(),
  ]);
};

export type GoogleInteractionsContentBlock = z.infer<
  ReturnType<typeof contentBlockSchema>
>;

const BUILTIN_TOOL_CALL_STEP_TYPES = [
  'google_search_call',
  'code_execution_call',
  'url_context_call',
  'file_search_call',
  'google_maps_call',
  'mcp_server_tool_call',
] as const;

const BUILTIN_TOOL_RESULT_STEP_TYPES = [
  'google_search_result',
  'code_execution_result',
  'url_context_result',
  'file_search_result',
  'google_maps_result',
  'mcp_server_tool_result',
] as const;

/*
 * Step schema union — elements of `response.steps[]` and the `step` field on
 * `step.start` SSE events.
 *
 * - `user_input` echoes a turn the client sent; only appears on
 *   `GET /interactions/{id}` (the full timeline). The SDK skips it.
 * - `model_output` wraps the model's text/image content in `step.content[]`.
 * - `function_call`, `thought`, and the built-in `*_call`/`*_result` steps
 *   carry their payload directly on the step (no `content` indirection).
 */
const stepSchema = () => {
  const userInputStep = z
    .object({
      type: z.literal('user_input'),
      content: z.array(contentBlockSchema()).nullish(),
    })
    .loose();

  const modelOutputStep = z
    .object({
      type: z.literal('model_output'),
      content: z.array(contentBlockSchema()).nullish(),
    })
    .loose();

  const functionCallStep = z
    .object({
      type: z.literal('function_call'),
      id: z.string(),
      name: z.string(),
      arguments: z.record(z.string(), z.unknown()).nullish(),
      signature: z.string().nullish(),
    })
    .loose();

  const thoughtStep = z
    .object({
      type: z.literal('thought'),
      signature: z.string().nullish(),
      summary: z.array(thoughtSummaryItemSchema()).nullish(),
    })
    .loose();

  const builtinToolCallStep = z
    .object({
      type: z.enum(BUILTIN_TOOL_CALL_STEP_TYPES),
      id: z.string(),
      arguments: z.record(z.string(), z.unknown()).nullish(),
      name: z.string().nullish(),
      server_name: z.string().nullish(),
      search_type: z.string().nullish(),
      signature: z.string().nullish(),
    })
    .loose();

  const builtinToolResultStep = z
    .object({
      type: z.enum(BUILTIN_TOOL_RESULT_STEP_TYPES),
      call_id: z.string(),
      result: z.unknown().nullish(),
      is_error: z.boolean().nullish(),
      name: z.string().nullish(),
      server_name: z.string().nullish(),
      signature: z.string().nullish(),
    })
    .loose();

  return z.union([
    userInputStep,
    modelOutputStep,
    functionCallStep,
    thoughtStep,
    builtinToolCallStep,
    builtinToolResultStep,
    z.object({ type: z.string() }).loose(),
  ]);
};

export type GoogleInteractionsStep = z.infer<ReturnType<typeof stepSchema>>;

export const googleInteractionsResponseSchema = lazySchema(() =>
  zodSchema(
    z
      .object({
        /*
         * `id` is omitted from the response body when `store: false` (fully
         * stateless mode) — there is no server-side interaction record for the
         * client to reference. `nullish` lets the schema accept that shape.
         */
        id: z.string().nullish(),
        created: z.string().nullish(),
        updated: z.string().nullish(),
        status: interactionStatusSchema(),
        model: z.string().nullish(),
        agent: z.string().nullish(),
        steps: z.array(stepSchema()).nullish(),
        usage: usageSchema().nullish(),
        service_tier: z.string().nullish(),
        previous_interaction_id: z.string().nullish(),
        response_modalities: z.array(z.string()).nullish(),
      })
      .loose(),
  ),
);

export type GoogleInteractionsResponse = InferSchema<
  typeof googleInteractionsResponseSchema
>;

export const googleInteractionsEventSchema = lazySchema(() =>
  zodSchema(
    (() => {
      const status = interactionStatusSchema();
      const annotation = annotationSchema();
      const thoughtSummaryItem = thoughtSummaryItemSchema();

      const interactionCreatedEvent = z
        .object({
          event_type: z.literal('interaction.created'),
          event_id: z.string().nullish(),
          interaction: z
            .object({
              /*
               * `id` is omitted when `store: false` (fully stateless mode);
               * see the matching note on `googleInteractionsResponseSchema.id`.
               */
              id: z.string().nullish(),
              created: z.string().nullish(),
              model: z.string().nullish(),
              agent: z.string().nullish(),
              status: status.nullish(),
            })
            .loose(),
        })
        .loose();

      /*
       * `step.start` carries the discriminated step shape under `step`. For
       * `function_call` steps the `name` is included here; for `thought`
       * steps the initial `signature` and `summary` arrive here when set.
       */
      const stepStartEvent = z
        .object({
          event_type: z.literal('step.start'),
          event_id: z.string().nullish(),
          index: z.number(),
          step: stepSchema(),
        })
        .loose();

      const stepDeltaText = z
        .object({
          type: z.literal('text'),
          text: z.string(),
        })
        .loose();

      const stepDeltaThoughtSummary = z
        .object({
          type: z.literal('thought_summary'),
          content: thoughtSummaryItem.nullish(),
        })
        .loose();

      const stepDeltaThoughtSignature = z
        .object({
          type: z.literal('thought_signature'),
          signature: z.string().nullish(),
        })
        .loose();

      /*
       * `function_call` step deltas stream the JSON arguments as a partial
       * string. Wire shape:
       *   { type: 'arguments_delta', arguments: '<partial-json-string>' }
       * The partial JSON lives in `arguments` (a string), not in a separate
       * `arguments_delta` field — the discriminator name is the only place
       * `arguments_delta` appears. Consumers accumulate the substrings and
       * parse on `step.stop`.
       */
      const stepDeltaArgumentsDelta = z
        .object({
          type: z.literal('arguments_delta'),
          arguments: z.string().nullish(),
          id: z.string().nullish(),
          signature: z.string().nullish(),
        })
        .loose();

      /*
       * URL/file/place-citation deltas. The discriminator is
       * `text_annotation_delta` (matching the `_delta` suffix used by
       * `arguments_delta`); `text_annotation` is also accepted as an alias.
       */
      const stepDeltaTextAnnotation = z
        .object({
          type: z.enum(['text_annotation_delta', 'text_annotation']),
          annotations: z.array(annotation).nullish(),
        })
        .loose();

      /*
       * `image` deltas carry the entire payload per delta (`data` base64 +
       * `mime_type`, or `uri`) — there is no per-byte streaming.
       */
      const stepDeltaImage = z
        .object({
          type: z.literal('image'),
          data: z.string().nullish(),
          mime_type: z.string().nullish(),
          resolution: z.enum(['low', 'medium', 'high', 'ultra_high']).nullish(),
          uri: z.string().nullish(),
        })
        .loose();

      /*
       * `video` deltas carry the entire payload per delta (`data` base64 +
       * `mime_type`, or `uri`) — there is no per-byte streaming.
       */
      const stepDeltaVideo = z
        .object({
          type: z.literal('video'),
          data: z.string().nullish(),
          mime_type: z.string().nullish(),
          uri: z.string().nullish(),
        })
        .loose();

      /*
       * Built-in tool call/result step deltas mirror the shape of their step
       * counterparts (full payload per delta — there is no per-token
       * streaming of arguments). Result deltas carry the populated `result`
       * payload.
       */
      const stepDeltaBuiltinToolCall = z
        .object({
          type: z.enum(BUILTIN_TOOL_CALL_STEP_TYPES),
          id: z.string().nullish(),
          arguments: z.record(z.string(), z.unknown()).nullish(),
          name: z.string().nullish(),
          server_name: z.string().nullish(),
          search_type: z.string().nullish(),
          signature: z.string().nullish(),
        })
        .loose();

      const stepDeltaBuiltinToolResult = z
        .object({
          type: z.enum(BUILTIN_TOOL_RESULT_STEP_TYPES),
          call_id: z.string().nullish(),
          result: z.unknown().nullish(),
          is_error: z.boolean().nullish(),
          name: z.string().nullish(),
          server_name: z.string().nullish(),
          signature: z.string().nullish(),
        })
        .loose();

      const stepDeltaUnknown = z.object({ type: z.string() }).loose();

      const stepDeltaUnion = z.union([
        stepDeltaText,
        stepDeltaImage,
        stepDeltaVideo,
        stepDeltaThoughtSummary,
        stepDeltaThoughtSignature,
        stepDeltaArgumentsDelta,
        stepDeltaTextAnnotation,
        stepDeltaBuiltinToolCall,
        stepDeltaBuiltinToolResult,
        stepDeltaUnknown,
      ]);

      const stepDeltaEvent = z
        .object({
          event_type: z.literal('step.delta'),
          event_id: z.string().nullish(),
          index: z.number(),
          delta: stepDeltaUnion,
        })
        .loose();

      const stepStopEvent = z
        .object({
          event_type: z.literal('step.stop'),
          event_id: z.string().nullish(),
          index: z.number(),
        })
        .loose();

      /*
       * Status-transition events. The API emits `interaction.status_update`
       * for in-progress and requires-action transitions; the more specific
       * `interaction.in_progress` and `interaction.requires_action` shapes
       * are accepted so all three route through the same handler.
       */
      const interactionStatusUpdateEvent = z
        .object({
          event_type: z.literal('interaction.status_update'),
          event_id: z.string().nullish(),
          interaction_id: z.string().nullish(),
          status: status.nullish(),
        })
        .loose();

      const interactionInProgressEvent = z
        .object({
          event_type: z.literal('interaction.in_progress'),
          event_id: z.string().nullish(),
          interaction_id: z.string().nullish(),
          status: status.nullish(),
        })
        .loose();

      const interactionRequiresActionEvent = z
        .object({
          event_type: z.literal('interaction.requires_action'),
          event_id: z.string().nullish(),
          interaction_id: z.string().nullish(),
          status: status.nullish(),
        })
        .loose();

      const interactionCompletedEvent = z
        .object({
          event_type: z.literal('interaction.completed'),
          event_id: z.string().nullish(),
          interaction: z
            .object({
              id: z.string().nullish(),
              status: status.nullish(),
              usage: usageSchema().nullish(),
              service_tier: z.string().nullish(),
            })
            .loose(),
        })
        .loose();

      const errorEvent = z
        .object({
          event_type: z.literal('error'),
          event_id: z.string().nullish(),
          error: z
            .object({
              code: z.string().nullish(),
              message: z.string().nullish(),
            })
            .loose()
            .nullish(),
        })
        .loose();

      const unknownEvent = z.object({ event_type: z.string() }).loose();

      return z.union([
        interactionCreatedEvent,
        stepStartEvent,
        stepDeltaEvent,
        stepStopEvent,
        interactionStatusUpdateEvent,
        interactionInProgressEvent,
        interactionRequiresActionEvent,
        interactionCompletedEvent,
        errorEvent,
        unknownEvent,
      ]);
    })(),
  ),
);

export type GoogleInteractionsEvent = InferSchema<
  typeof googleInteractionsEventSchema
>;
