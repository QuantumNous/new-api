import { lazySchema, zodSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

/**
 * Response schema for the Gemini `:generateContent` endpoint when called with
 * `responseModalities: ['AUDIO']`. The generated audio is returned as base64
 * encoded raw PCM in the first inline-data part.
 */
export const googleSpeechResponseSchema = lazySchema(() =>
  zodSchema(
    z.object({
      candidates: z
        .array(
          z.object({
            content: z
              .object({
                parts: z
                  .array(
                    z.object({
                      inlineData: z
                        .object({
                          mimeType: z.string().nullish(),
                          data: z.string().nullish(),
                        })
                        .nullish(),
                    }),
                  )
                  .nullish(),
              })
              .nullish(),
          }),
        )
        .nullish(),
    }),
  ),
);
