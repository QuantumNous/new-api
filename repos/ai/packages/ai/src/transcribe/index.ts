import type { TranscriptionResult } from './transcribe-result';
import { transcribe } from './transcribe';

export { transcribe } from './transcribe';
export { streamTranscribe as experimental_streamTranscribe } from './stream-transcribe';
export type {
  StreamTranscriptionResult,
  TranscriptionStreamPart,
} from './stream-transcribe-result';
export type { TranscriptionResult } from './transcribe-result';

// deprecated exports

/**
 * @deprecated Use `transcribe` instead.
 */
const experimental_transcribe = transcribe;
export { experimental_transcribe };

/**
 * @deprecated Use `TranscriptionResult` instead.
 */
type Experimental_TranscriptionResult = TranscriptionResult;
export type { Experimental_TranscriptionResult };
