import type { SpeechModelV2 } from '@ai-sdk/provider';
import { asSpeechModelV3 } from './as-speech-model-v3';
import { MockSpeechModelV2 } from '../test/mock-speech-model-v2';
import { MockSpeechModelV3 } from '../test/mock-speech-model-v3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logWarningsModule from '../logger/log-warnings';

describe('asSpeechModelV3', () => {
  let logWarningSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logWarningSpy = vi
      .spyOn(logWarningsModule, 'logWarnings')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    logWarningSpy.mockRestore();
  });

  describe('when a speech model v3 is provided', () => {
    it('should return the same v3 model unchanged', () => {
      const originalModel = new MockSpeechModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asSpeechModelV3(originalModel);

      expect(result).toBe(originalModel);
      expect(result.specificationVersion).toBe('v3');
    });

    it('should not log any warning', () => {
      const originalModel = new MockSpeechModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      asSpeechModelV3(originalModel);

      expect(logWarningSpy).not.toHaveBeenCalled();
    });

    it('should preserve all v3 model properties', () => {
      const originalModel = new MockSpeechModelV3({
        provider: 'test-provider-v3',
        modelId: 'test-model-v3',
      });

      const result = asSpeechModelV3(originalModel);

      expect(result.provider).toBe('test-provider-v3');
      expect(result.modelId).toBe('test-model-v3');
      expect(result.specificationVersion).toBe('v3');
    });
  });

  describe('when a speech model v2 is provided', () => {
    it('should convert v2 to v3 and change specificationVersion', () => {
      const v2Model = new MockSpeechModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asSpeechModelV3(v2Model);

      expect(result.specificationVersion).toBe('v3');
      expect(result).not.toBe(v2Model);
    });

    it('should log a compatibility warning', () => {
      const v2Model = new MockSpeechModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      asSpeechModelV3(v2Model);

      expect(logWarningSpy).toHaveBeenCalledWith({
        warnings: [
          {
            type: 'compatibility',
            feature: 'specificationVersion',
            details: expect.stringContaining(
              'Using v2 specification compatibility',
            ),
          },
        ],
        provider: 'test-provider',
        model: 'test-model-id',
      });
    });

    it('should preserve provider property', () => {
      const v2Model = new MockSpeechModelV2({
        provider: 'test-provider-v2',
        modelId: 'test-model-id',
      });

      const result = asSpeechModelV3(v2Model);

      expect(result.provider).toBe('test-provider-v2');
    });

    it('should preserve modelId property', () => {
      const v2Model = new MockSpeechModelV2({
        provider: 'test-provider',
        modelId: 'test-model-v2',
      });

      const result = asSpeechModelV3(v2Model);

      expect(result.modelId).toBe('test-model-v2');
    });

    it('should make doGenerate method callable with base64 audio', async () => {
      const v2Model = new MockSpeechModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          audio: 'base64encodedaudio',
          warnings: [],
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: undefined,
          },
        }),
      });

      const result = asSpeechModelV3(v2Model);

      const response = await result.doGenerate({
        text: 'Hello, world!',
      });

      expect(response.audio).toBe('base64encodedaudio');
    });

    it('should make doGenerate method callable with binary audio', async () => {
      const binaryAudio = new Uint8Array([1, 2, 3, 4, 5]);
      const v2Model = new MockSpeechModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          audio: binaryAudio,
          warnings: [],
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: undefined,
          },
        }),
      });

      const result = asSpeechModelV3(v2Model);

      const response = await result.doGenerate({
        text: 'Hello, world!',
      });

      expect(response.audio).toBe(binaryAudio);
    });

    it('should handle doGenerate with warnings', async () => {
      const v2Model = new MockSpeechModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          audio: 'base64audio',
          warnings: [
            {
              type: 'unsupported-setting',
              setting: 'speed',
              details: 'Speed setting not supported',
            },
          ],
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: undefined,
          },
        }),
      });

      const result = asSpeechModelV3(v2Model);

      const response = await result.doGenerate({
        text: 'Hello, world!',
      });

      expect(response.warnings).toHaveLength(1);
      expect(response.warnings[0].type).toBe('unsupported-setting');
    });

    it('should handle doGenerate with request metadata', async () => {
      const v2Model = new MockSpeechModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          audio: 'base64audio',
          warnings: [],
          request: {
            body: { text: 'Hello, world!' },
          },
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: undefined,
          },
        }),
      });

      const result = asSpeechModelV3(v2Model);

      const response = await result.doGenerate({
        text: 'Hello, world!',
      });

      expect(response.request?.body).toEqual({ text: 'Hello, world!' });
    });

    it('should handle doGenerate with response headers', async () => {
      const v2Model = new MockSpeechModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          audio: 'base64audio',
          warnings: [],
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: { 'x-custom': 'header-value' },
          },
        }),
      });

      const result = asSpeechModelV3(v2Model);

      const response = await result.doGenerate({
        text: 'Hello, world!',
      });

      expect(response.response.headers).toEqual({ 'x-custom': 'header-value' });
    });

    it('should handle doGenerate with response body', async () => {
      const v2Model = new MockSpeechModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          audio: 'base64audio',
          warnings: [],
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: undefined,
            body: { raw: 'response data' },
          },
        }),
      });

      const result = asSpeechModelV3(v2Model);

      const response = await result.doGenerate({
        text: 'Hello, world!',
      });

      expect(response.response.body).toEqual({ raw: 'response data' });
    });

    it('should handle doGenerate with provider metadata', async () => {
      const v2Model = new MockSpeechModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          audio: 'base64audio',
          warnings: [],
          providerMetadata: {
            testProvider: { customField: 'value' },
          },
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: undefined,
          },
        }),
      });

      const result = asSpeechModelV3(v2Model);

      const response = await result.doGenerate({
        text: 'Hello, world!',
      });

      expect(response.providerMetadata?.testProvider).toEqual({
        customField: 'value',
      });
    });

    it('should handle doGenerate with response metadata', async () => {
      const timestamp = new Date();
      const v2Model = new MockSpeechModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          audio: 'base64audio',
          warnings: [],
          response: {
            timestamp,
            modelId: 'actual-model-id',
            headers: undefined,
          },
        }),
      });

      const result = asSpeechModelV3(v2Model);

      const response = await result.doGenerate({
        text: 'Hello, world!',
      });

      expect(response.response.timestamp).toBe(timestamp);
      expect(response.response.modelId).toBe('actual-model-id');
    });

    it('should preserve prototype methods when using class instances', async () => {
      class TestSpeechModelV2 implements SpeechModelV2 {
        readonly specificationVersion = 'v2' as const;
        readonly provider = 'test-provider';
        readonly modelId = 'test-model-id';

        customMethod() {
          return 'custom-value';
        }

        async doGenerate() {
          return {
            audio: 'base64audio',
            warnings: [],
            response: {
              timestamp: new Date(),
              modelId: 'test-model',
              headers: undefined,
            },
          };
        }
      }

      const v2Model = new TestSpeechModelV2();
      const result = asSpeechModelV3(v2Model) as any;

      expect(result.customMethod()).toBe('custom-value');
      expect(result.specificationVersion).toBe('v3');
    });
  });
});
