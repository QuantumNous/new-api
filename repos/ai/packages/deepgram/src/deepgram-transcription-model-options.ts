import { z } from 'zod/v4';

// https://developers.deepgram.com/docs/pre-recorded-audio#results
export const deepgramTranscriptionModelOptionsSchema = z.object({
  /** Language to use for transcription. If not specified, Deepgram defaults to English. Use `detectLanguage: true` to enable automatic language detection. */
  language: z.string().nullish(),
  /** Whether to enable automatic language detection. When true, Deepgram will detect the language of the audio. */
  detectLanguage: z.boolean().nullish(),
  /** Whether to use smart formatting, which formats written-out numbers, dates, times, etc. */
  smartFormat: z.boolean().nullish(),
  /** Whether to add punctuation to the transcript. */
  punctuate: z.boolean().nullish(),
  /** Whether to format the transcript into paragraphs. */
  paragraphs: z.boolean().nullish(),
  /** Whether to generate a summary of the transcript. Use 'v2' for the latest version or false to disable. */
  summarize: z.union([z.literal('v2'), z.literal(false)]).nullish(),
  /** Whether to identify topics in the transcript. */
  topics: z.boolean().nullish(),
  /** Whether to identify intents in the transcript. */
  intents: z.boolean().nullish(),
  /** Whether to analyze sentiment in the transcript. */
  sentiment: z.boolean().nullish(),
  /** Whether to detect and tag named entities in the transcript. */
  detectEntities: z.boolean().nullish(),
  /** Specify terms or patterns to redact from the transcript. Can be a string or array of strings. */
  redact: z.union([z.string(), z.array(z.string())]).nullish(),
  /** String to replace redacted content with. */
  replace: z.string().nullish(),
  /** Term or phrase to search for in the transcript. */
  search: z.string().nullish(),
  /** Key term to identify in the transcript. */
  keyterm: z.string().nullish(),
  /** Whether to identify different speakers in the audio. */
  diarize: z.boolean().nullish(),
  /** Whether to segment the transcript into utterances. */
  utterances: z.boolean().nullish(),
  /** Minimum duration of silence (in seconds) to trigger a new utterance. */
  uttSplit: z.number().nullish(),
  /** Whether to include filler words (um, uh, etc.) in the transcript. */
  fillerWords: z.boolean().nullish(),
});

export type DeepgramTranscriptionModelOptions = z.infer<
  typeof deepgramTranscriptionModelOptionsSchema
>;
