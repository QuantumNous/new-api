import { simulateReadableStream as originalSimulateReadableStream } from '../src/util/simulate-readable-stream';

export {
  convertArrayToAsyncIterable,
  convertArrayToReadableStream,
  convertReadableStreamToArray,
  mockId,
} from '@ai-sdk/provider-utils/test';
export { MockEmbeddingModelV3 } from '../src/test/mock-embedding-model-v3';
export { MockEmbeddingModelV4 } from '../src/test/mock-embedding-model-v4';
export { MockImageModelV3 } from '../src/test/mock-image-model-v3';
export { MockImageModelV4 } from '../src/test/mock-image-model-v4';
export { MockLanguageModelV3 } from '../src/test/mock-language-model-v3';
export { MockLanguageModelV4 } from '../src/test/mock-language-model-v4';
export { MockProviderV3 } from '../src/test/mock-provider-v3';
export { MockProviderV4 } from '../src/test/mock-provider-v4';
export { MockSpeechModelV3 } from '../src/test/mock-speech-model-v3';
export { MockSpeechModelV4 } from '../src/test/mock-speech-model-v4';
export { MockTranscriptionModelV3 } from '../src/test/mock-transcription-model-v3';
export { MockTranscriptionModelV4 } from '../src/test/mock-transcription-model-v4';
export { MockRerankingModelV3 } from '../src/test/mock-reranking-model-v3';
export { MockRerankingModelV4 } from '../src/test/mock-reranking-model-v4';
export { MockVideoModelV3 } from '../src/test/mock-video-model-v3';
export { MockVideoModelV4 } from '../src/test/mock-video-model-v4';
export { mockValues } from '../src/test/mock-values';

/**
 * @deprecated Use `simulateReadableStream` from `ai` instead.
 */
export const simulateReadableStream = originalSimulateReadableStream;
