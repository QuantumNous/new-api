import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logWarningsModule from '../logger/log-warnings';
import { MockSpeechModelV2 } from '../test/mock-speech-model-v2';
import { MockSpeechModelV3 } from '../test/mock-speech-model-v3';
import { MockSpeechModelV4 } from '../test/mock-speech-model-v4';
import { asSpeechModelV4 } from './as-speech-model-v4';

describe('asSpeechModelV4', () => {
  let logWarningSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logWarningSpy = vi
      .spyOn(logWarningsModule, 'logWarnings')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    logWarningSpy.mockRestore();
  });

  describe('when a speech model v4 is provided', () => {
    it('should return the same v4 model unchanged', () => {
      const originalModel = new MockSpeechModelV4({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asSpeechModelV4(originalModel);

      expect(result).toBe(originalModel);
      expect(result.specificationVersion).toBe('v4');
    });

    it('should preserve all v4 model properties', () => {
      const originalModel = new MockSpeechModelV4({
        provider: 'test-provider-v4',
        modelId: 'test-model-v4',
      });

      const result = asSpeechModelV4(originalModel);

      expect(result.provider).toBe('test-provider-v4');
      expect(result.modelId).toBe('test-model-v4');
    });
  });

  describe('when a speech model v3 is provided', () => {
    it('should convert v3 to v4 and change specificationVersion', () => {
      const v3Model = new MockSpeechModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asSpeechModelV4(v3Model);

      expect(result.specificationVersion).toBe('v4');
      expect(result).not.toBe(v3Model);
    });

    it('should preserve provider property', () => {
      const v3Model = new MockSpeechModelV3({
        provider: 'test-provider-v3',
        modelId: 'test-model-id',
      });

      const result = asSpeechModelV4(v3Model);

      expect(result.provider).toBe('test-provider-v3');
    });

    it('should preserve modelId property', () => {
      const v3Model = new MockSpeechModelV3({
        provider: 'test-provider',
        modelId: 'test-model-v3',
      });

      const result = asSpeechModelV4(v3Model);

      expect(result.modelId).toBe('test-model-v3');
    });

    it('should make doGenerate method callable', async () => {
      const v3Model = new MockSpeechModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          audio: 'base64audio',
          warnings: [],
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: undefined,
          },
        }),
      });

      const result = asSpeechModelV4(v3Model);

      const response = await result.doGenerate({
        text: 'Hello, world!',
      });

      expect(response.audio).toBe('base64audio');
    });
  });

  describe('when a speech model v2 is provided', () => {
    it('should convert v2 through v3 to v4', () => {
      const v2Model = new MockSpeechModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asSpeechModelV4(v2Model);

      expect(result.specificationVersion).toBe('v4');
      expect(result.provider).toBe('test-provider');
      expect(result.modelId).toBe('test-model-id');
    });
  });
});
