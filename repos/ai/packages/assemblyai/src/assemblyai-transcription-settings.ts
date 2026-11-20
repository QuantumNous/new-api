/**
 * Legacy AssemblyAI speech model, sent via the deprecated singular
 * `speech_model` request parameter.
 *
 * @deprecated Use `universal-3-5-pro` instead.
 * @see https://www.assemblyai.com/docs/pre-recorded-audio/select-the-speech-model
 */
export type AssemblyAIDeprecatedTranscriptionModelId = 'best';

export type AssemblyAITranscriptionModelId =
  | 'universal-2'
  | 'universal-3-pro'
  | 'universal-3-5-pro'
  | AssemblyAIDeprecatedTranscriptionModelId
  | (string & {});
