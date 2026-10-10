import { z } from 'zod/v4';

// https://dev.hume.ai/reference/text-to-speech-tts/synthesize-file
export const humeSpeechModelOptionsSchema = z.object({
  /**
   * Context for the speech synthesis request.
   * Can be either a generationId for retrieving a previous generation,
   * or a list of utterances to synthesize.
   */
  context: z
    .object({
      /**
       * ID of a previously generated speech synthesis to retrieve.
       */
      generationId: z.string(),
    })
    .or(
      z.object({
        /**
         * List of utterances to synthesize into speech.
         */
        utterances: z.array(
          z.object({
            /**
             * The text content to convert to speech.
             */
            text: z.string(),
            /**
             * Optional description or instructions for how the text should be spoken.
             */
            description: z.string().optional(),
            /**
             * Optional speech rate multiplier.
             */
            speed: z.number().optional(),
            /**
             * Optional duration of silence to add after the utterance in seconds.
             */
            trailingSilence: z.number().optional(),
            /**
             * Voice configuration for the utterance.
             * Can be specified by ID or name.
             */
            voice: z
              .object({
                /**
                 * ID of the voice to use.
                 */
                id: z.string(),
                /**
                 * Provider of the voice, either Hume's built-in voices or a custom voice.
                 */
                provider: z.enum(['HUME_AI', 'CUSTOM_VOICE']).optional(),
              })
              .or(
                z.object({
                  /**
                   * Name of the voice to use.
                   */
                  name: z.string(),
                  /**
                   * Provider of the voice, either Hume's built-in voices or a custom voice.
                   */
                  provider: z.enum(['HUME_AI', 'CUSTOM_VOICE']).optional(),
                }),
              )
              .optional(),
          }),
        ),
      }),
    )
    .nullish(),
});

export type HumeSpeechModelOptions = z.infer<
  typeof humeSpeechModelOptionsSchema
>;
