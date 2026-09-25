// @ts-nocheck
import {
  MockEmbeddingModelV2,
  MockImageModelV2,
  MockLanguageModelV2,
  MockProviderV2,
  MockSpeechModelV2,
  MockTranscriptionModelV2,
} from 'ai/test';

const languageModel = new MockLanguageModelV2();

const embeddingModel = new MockEmbeddingModelV2();

const imageModel = new MockImageModelV2();

const provider = new MockProviderV2();

const speechModel = new MockSpeechModelV2();

const transcriptionModel = new MockTranscriptionModelV2();

// Type annotations
function testWithModel(model: MockLanguageModelV2) {
  return model;
}

// Using as type parameter
const models: MockLanguageModelV2[] = [];

// Function that returns a mock
function createMock(): MockEmbeddingModelV2 {
  return new MockEmbeddingModelV2();
}

// In object type
interface TestConfig {
  model: MockLanguageModelV2;
  embedding: MockEmbeddingModelV2;
}

