import { describe, it, expect } from 'vitest';
import { createHuggingFace } from './huggingface-provider';

describe('HuggingFaceProvider', () => {
  describe('createHuggingFace', () => {
    it('should create provider with default configuration', () => {
      const provider = createHuggingFace();

      expect(provider).toMatchInlineSnapshot(`[Function]`);
      expect(typeof provider.responses).toBe('function');
      expect(typeof provider.languageModel).toBe('function');
    });

    it('should create provider with custom settings', () => {
      const provider = createHuggingFace({
        apiKey: 'custom-key',
        baseURL: 'https://custom.url',
        headers: { 'Custom-Header': 'test' },
      });

      expect(typeof provider).toBe('function');
      expect(provider).toHaveProperty('responses');
      expect(provider).toHaveProperty('languageModel');
    });
  });

  describe('model creation methods', () => {
    it('should expose responses method', () => {
      const provider = createHuggingFace();

      expect(typeof provider.responses).toBe('function');
    });

    it('should expose languageModel method', () => {
      const provider = createHuggingFace();

      expect(typeof provider.languageModel).toBe('function');
    });
  });

  describe('unsupported functionality', () => {
    it('should throw for text embedding models', () => {
      const provider = createHuggingFace();

      expect(() =>
        provider.embeddingModel('any-model'),
      ).toThrowErrorMatchingInlineSnapshot(
        `[AI_NoSuchModelError: Hugging Face Responses API does not support text embeddings. Use the Hugging Face Inference API directly for embeddings.]`,
      );
    });

    it('should throw for image models', () => {
      const provider = createHuggingFace();

      expect(() =>
        provider.imageModel('any-model'),
      ).toThrowErrorMatchingInlineSnapshot(
        `[AI_NoSuchModelError: Hugging Face Responses API does not support image generation. Use the Hugging Face Inference API directly for image models.]`,
      );
    });
  });
});
