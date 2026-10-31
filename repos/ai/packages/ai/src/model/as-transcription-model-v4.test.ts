import { describe, expect, it } from 'vitest';
import { MockTranscriptionModelV2 } from '../test/mock-transcription-model-v2';
import { MockTranscriptionModelV3 } from '../test/mock-transcription-model-v3';
import { MockTranscriptionModelV4 } from '../test/mock-transcription-model-v4';
import { asTranscriptionModelV4 } from './as-transcription-model-v4';

describe('asTranscriptionModelV4', () => {
  describe('when a transcription model v4 is provided', () => {
    it('should return the same v4 model unchanged', () => {
      const originalModel = new MockTranscriptionModelV4({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asTranscriptionModelV4(originalModel);

      expect(result).toBe(originalModel);
      expect(result.specificationVersion).toBe('v4');
    });

    it('should preserve all v4 model properties', () => {
      const originalModel = new MockTranscriptionModelV4({
        provider: 'test-provider-v4',
        modelId: 'test-model-v4',
      });

      const result = asTranscriptionModelV4(originalModel);

      expect(result.provider).toBe('test-provider-v4');
      expect(result.modelId).toBe('test-model-v4');
    });
  });

  describe('when a transcription model v3 is provided', () => {
    it('should convert v3 to v4 and change specificationVersion', () => {
      const v3Model = new MockTranscriptionModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asTranscriptionModelV4(v3Model);

      expect(result.specificationVersion).toBe('v4');
      expect(result).not.toBe(v3Model);
    });

    it('should preserve provider property', () => {
      const v3Model = new MockTranscriptionModelV3({
        provider: 'test-provider-v3',
        modelId: 'test-model-id',
      });

      const result = asTranscriptionModelV4(v3Model);

      expect(result.provider).toBe('test-provider-v3');
    });

    it('should preserve modelId property', () => {
      const v3Model = new MockTranscriptionModelV3({
        provider: 'test-provider',
        modelId: 'test-model-v3',
      });

      const result = asTranscriptionModelV4(v3Model);

      expect(result.modelId).toBe('test-model-v3');
    });

    it('should make doGenerate method callable', async () => {
      const v3Model = new MockTranscriptionModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          text: 'Hello, world!',
          segments: [
            {
              text: 'Hello, world!',
              startSecond: 0,
              endSecond: 2.5,
            },
          ],
          language: 'en',
          durationInSeconds: 2.5,
          warnings: [],
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: undefined,
          },
        }),
      });

      const result = asTranscriptionModelV4(v3Model);

      const response = await result.doGenerate({
        audio: new Uint8Array([1, 2, 3]),
        mediaType: 'audio/wav',
      });

      expect(response.text).toBe('Hello, world!');
      expect(response.segments).toHaveLength(1);
    });
  });

  describe('when a transcription model v2 is provided', () => {
    it('should convert v2 through v3 to v4', () => {
      const v2Model = new MockTranscriptionModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asTranscriptionModelV4(v2Model);

      expect(result.specificationVersion).toBe('v4');
      expect(result.provider).toBe('test-provider');
      expect(result.modelId).toBe('test-model-id');
    });
  });
});
