import {
  lazySchema,
  zodSchema,
  type InferSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

/**
 * Type-only union of Gemini model IDs that the Interactions API accepts via
 * `model:`. Mirrors `Model` from `googleapis/js-genai`
 * `src/interactions/resources/interactions.ts`.
 *
 * Kept as a separate type from `GoogleModelId` even though most IDs overlap;
 * the two surfaces (`:generateContent` vs `/interactions`) are independent and
 * may diverge over time.
 */
export type GoogleInteractionsModelId =
  | 'gemini-2.5-computer-use-preview-10-2025'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-flash-image'
  | 'gemini-2.5-flash-lite'
  | 'gemini-2.5-flash-lite-preview-09-2025'
  | 'gemini-2.5-flash-native-audio-preview-12-2025'
  | 'gemini-2.5-flash-preview-09-2025'
  | 'gemini-2.5-flash-preview-tts'
  | 'gemini-2.5-pro'
  | 'gemini-2.5-pro-preview-tts'
  | 'gemini-3-flash-preview'
  | 'gemini-3-pro-image-preview'
  | 'gemini-3-pro-preview'
  | 'gemini-3.1-pro-preview'
  | 'gemini-3.1-flash-image-preview'
  | 'gemini-3.1-flash-lite-preview'
  | 'gemini-3.1-flash-tts-preview'
  | 'gemini-3.5-flash'
  | 'lyria-3-clip-preview'
  | 'lyria-3-pro-preview'
  | (string & {});

/**
 * Provider-options schema for `google.interactions(...)` calls. Read from the
 * shared `providerOptions.google.*` namespace (per PRD); per-call options that
 * the AI SDK doesn't natively expose live here.
 *
 * All fields are `.nullish()` per the existing google provider convention.
 */
export const googleInteractionsLanguageModelOptions = lazySchema(() =>
  zodSchema(
    z.object({
      previousInteractionId: z.string().nullish(),
      store: z.boolean().nullish(),

      agent: z.string().nullish(),
      agentConfig: z
        .union([
          z
            .object({
              type: z.literal('dynamic'),
            })
            .loose(),
          z.object({
            type: z.literal('deep-research'),
            thinkingSummaries: z.enum(['auto', 'none']).nullish(),
            visualization: z.enum(['off', 'auto']).nullish(),
            collaborativePlanning: z.boolean().nullish(),
          }),
        ])
        .nullish(),

      thinkingLevel: z.enum(['minimal', 'low', 'medium', 'high']).nullish(),
      thinkingSummaries: z.enum(['auto', 'none']).nullish(),

      /**
       * Output-format entries that map directly to the API's `response_format`
       * array. Use this to request image, audio, or non-JSON text outputs
       * with full control over `mime_type`, `aspect_ratio`, and `image_size`.
       *
       * Entries are sent in order. The AI SDK call-level `responseFormat: {
       * type: 'json', schema }` still drives JSON-mode and adds a matching
       * text entry automatically; entries listed here are appended.
       */
      responseFormat: z
        .array(
          z.union([
            z
              .object({
                type: z.literal('text'),
                mimeType: z.string().nullish(),
                schema: z.unknown().nullish(),
              })
              .loose(),
            z
              .object({
                type: z.literal('image'),
                mimeType: z.string().nullish(),
                aspectRatio: z
                  .enum([
                    '1:1',
                    '2:3',
                    '3:2',
                    '3:4',
                    '4:3',
                    '4:5',
                    '5:4',
                    '9:16',
                    '16:9',
                    '21:9',
                    '1:8',
                    '8:1',
                    '1:4',
                    '4:1',
                  ])
                  .nullish(),
                imageSize: z.enum(['1K', '2K', '4K', '512']).nullish(),
              })
              .loose(),
            z
              .object({
                type: z.literal('audio'),
                mimeType: z.string().nullish(),
              })
              .loose(),
          ]),
        )
        .nullish(),

      /**
       * @deprecated Use `responseFormat` with a `{ type: 'image', ... }`
       * entry instead. Retained for backwards compatibility; the SDK
       * translates it into a matching `response_format` image entry and
       * emits a warning when set.
       */
      imageConfig: z
        .object({
          aspectRatio: z
            .enum([
              '1:1',
              '2:3',
              '3:2',
              '3:4',
              '4:3',
              '4:5',
              '5:4',
              '9:16',
              '16:9',
              '21:9',
              '1:8',
              '8:1',
              '1:4',
              '4:1',
            ])
            .nullish(),
          imageSize: z.enum(['1K', '2K', '4K', '512']).nullish(),
        })
        .nullish(),
      mediaResolution: z
        .enum(['low', 'medium', 'high', 'ultra_high'])
        .nullish(),

      responseModalities: z
        .array(z.enum(['text', 'image', 'audio', 'video', 'document']))
        .nullish(),
      serviceTier: z.enum(['flex', 'standard', 'priority']).nullish(),

      /**
       * Alternative to AI SDK `system` message. If both are set, the AI SDK
       * `system` message wins and a warning is emitted.
       */
      systemInstruction: z.string().nullish(),

      /**
       * Per-block signature for round-tripping `thought.signature` and
       * `function_call.signature` blocks. Set by the SDK on output reasoning /
       * tool-call parts; passed back unchanged on input parts so the API
       * accepts the prior turn.
       */
      signature: z.string().nullish(),

      /**
       * Set by the SDK on output assistant messages. The converter uses it to
       * decide which messages to drop when compacting under
       * `previousInteractionId`.
       */
      interactionId: z.string().nullish(),

      /**
       * Maximum time, in milliseconds, to poll a background interaction (agent
       * call) before giving up. Defaults to 30 minutes. Long-running agents
       * such as deep research can take tens of minutes — increase if needed.
       */
      pollingTimeoutMs: z.number().int().positive().nullish(),

      /**
       * Run the interaction in the background. Required for agents whose
       * server-side workflow cannot complete within a single request/response.
       * When `true`, the POST returns with a non-terminal status and the SDK
       * polls `GET /interactions/{id}` until the work completes. Some agents
       * reject `true`; see the agent's documentation for which mode it
       * requires.
       */
      background: z.boolean().nullish(),

      /**
       * Environment configuration for the agent sandbox. Only applies to agent
       * calls (`google.interactions({ agent })`); ignored on model-id calls.
       *
       *   - `"remote"`: provision a fresh sandbox for this call.
       *   - any other string: an existing `environment_id` to reuse.
       *   - object: provision a fresh sandbox and optionally preload `sources`
       *     and/or constrain outbound traffic via `network`.
       */
      environment: z
        .union([
          z.string(),
          z.object({
            type: z.literal('remote'),
            sources: z
              .array(
                z.union([
                  z.object({
                    type: z.literal('gcs'),
                    source: z.string(),
                    target: z.string().nullish(),
                  }),
                  z.object({
                    type: z.literal('repository'),
                    source: z.string(),
                    target: z.string().nullish(),
                  }),
                  z.object({
                    type: z.literal('inline'),
                    content: z.string(),
                    target: z.string(),
                  }),
                ]),
              )
              .nullish(),
            network: z
              .union([
                z.literal('disabled'),
                z.object({
                  allowlist: z.array(
                    z.object({
                      domain: z.string(),
                      transform: z
                        .array(z.record(z.string(), z.string()))
                        .nullish(),
                    }),
                  ),
                }),
              ])
              .nullish(),
          }),
        ])
        .nullish(),
    }),
  ),
);

export type GoogleLanguageModelInteractionsOptions = InferSchema<
  typeof googleInteractionsLanguageModelOptions
>;
