// @ts-nocheck
import {
  MockEmbeddingModelV3,
  MockImageModelV3,
  MockLanguageModelV3,
  MockProviderV3,
  MockSpeechModelV3,
  MockTranscriptionModelV3,
} from 'ai/test';

const languageModel = new MockLanguageModelV3();

const embeddingModel = new MockEmbeddingModelV3();

const imageModel = new MockImageModelV3();

const provider = new MockProviderV3();

const speechModel = new MockSpeechModelV3();

const transcriptionModel = new MockTranscriptionModelV3();

// Type annotations
function testWithModel(model: MockLanguageModelV3) {
  return model;
}

// Using as type parameter
const models: MockLanguageModelV3[] = [];

// Function that returns a mock
function createMock(): MockEmbeddingModelV3 {
  return new MockEmbeddingModelV3();
}

// In object type
interface TestConfig {
  model: MockLanguageModelV3;
  embedding: MockEmbeddingModelV3;
}

