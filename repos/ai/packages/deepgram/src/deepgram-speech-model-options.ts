import { z } from 'zod/v4';

// https://developers.deepgram.com/reference/text-to-speech/speak-request
export const deepgramSpeechModelOptionsSchema = z.object({
  /** Bitrate of the audio in bits per second. Can be a number or predefined enum value. */
  bitRate: z.union([z.number(), z.string()]).nullish(),
  /** Container format for the output audio (mp3, wav, etc.). */
  container: z.string().nullish(),
  /** Encoding type for the audio output (linear16, mulaw, alaw, etc.). */
  encoding: z.string().nullish(),
  /** Sample rate for the output audio in Hz (8000, 16000, 24000, 44100, 48000). */
  sampleRate: z.number().nullish(),
  /** URL to which we'll make the callback request. */
  callback: z.string().url().nullish(),
  /** HTTP method by which the callback request will be made (POST or PUT). */
  callbackMethod: z.enum(['POST', 'PUT']).nullish(),
  /** Opts out requests from the Deepgram Model Improvement Program. */
  mipOptOut: z.boolean().nullish(),
  /** Label your requests for the purpose of identification during usage reporting. */
  tag: z.union([z.string(), z.array(z.string())]).nullish(),
});

export type DeepgramSpeechModelOptions = z.infer<
  typeof deepgramSpeechModelOptionsSchema
>;
