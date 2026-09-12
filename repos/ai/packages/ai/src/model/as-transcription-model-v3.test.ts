import type { TranscriptionModelV2 } from '@ai-sdk/provider';
import { asTranscriptionModelV3 } from './as-transcription-model-v3';
import { MockTranscriptionModelV2 } from '../test/mock-transcription-model-v2';
import { MockTranscriptionModelV3 } from '../test/mock-transcription-model-v3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logWarningsModule from '../logger/log-warnings';

describe('asTranscriptionModelV3', () => {
  let logWarningSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logWarningSpy = vi
      .spyOn(logWarningsModule, 'logWarnings')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    logWarningSpy.mockRestore();
  });

  describe('when a transcription model v3 is provided', () => {
    it('should return the same v3 model unchanged', () => {
      const originalModel = new MockTranscriptionModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asTranscriptionModelV3(originalModel);

      expect(result).toBe(originalModel);
      expect(result.specificationVersion).toBe('v3');
    });

    it('should not log any warning', () => {
      const originalModel = new MockTranscriptionModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      asTranscriptionModelV3(originalModel);

      expect(logWarningSpy).not.toHaveBeenCalled();
    });

    it('should preserve all v3 model properties', () => {
      const originalModel = new MockTranscriptionModelV3({
        provider: 'test-provider-v3',
        modelId: 'test-model-v3',
      });

      const result = asTranscriptionModelV3(originalModel);

      expect(result.provider).toBe('test-provider-v3');
      expect(result.modelId).toBe('test-model-v3');
      expect(result.specificationVersion).toBe('v3');
    });
  });

  describe('when a transcription model v2 is provided', () => {
    it('should convert v2 to v3 and change specificationVersion', () => {
      const v2Model = new MockTranscriptionModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asTranscriptionModelV3(v2Model);

      expect(result.specificationVersion).toBe('v3');
      expect(result).not.toBe(v2Model);
    });

    it('should log a compatibility warning', () => {
      const v2Model = new MockTranscriptionModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      asTranscriptionModelV3(v2Model);

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
      const v2Model = new MockTranscriptionModelV2({
        provider: 'test-provider-v2',
        modelId: 'test-model-id',
      });

      const result = asTranscriptionModelV3(v2Model);

      expect(result.provider).toBe('test-provider-v2');
    });

    it('should preserve modelId property', () => {
      const v2Model = new MockTranscriptionModelV2({
        provider: 'test-provider',
        modelId: 'test-model-v2',
      });

      const result = asTranscriptionModelV3(v2Model);

      expect(result.modelId).toBe('test-model-v2');
    });

    it('should make doGenerate method callable', async () => {
      const v2Model = new MockTranscriptionModelV2({
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

      const result = asTranscriptionModelV3(v2Model);

      const response = await result.doGenerate({
        audio: new Uint8Array([1, 2, 3]),
        mediaType: 'audio/wav',
      });

      expect(response.text).toBe('Hello, world!');
      expect(response.segments).toHaveLength(1);
    });

    it('should handle doGenerate with multiple segments', async () => {
      const v2Model = new MockTranscriptionModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          text: 'Hello, world! How are you?',
          segments: [
            {
              text: 'Hello, world!',
              startSecond: 0,
              endSecond: 2.0,
            },
            {
              text: 'How are you?',
              startSecond: 2.0,
              endSecond: 4.5,
            },
          ],
          language: 'en',
          durationInSeconds: 4.5,
          warnings: [],
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: undefined,
          },
        }),
      });

      const result = asTranscriptionModelV3(v2Model);

      const response = await result.doGenerate({
        audio: new Uint8Array([1, 2, 3]),
        mediaType: 'audio/wav',
      });

      expect(response.text).toBe('Hello, world! How are you?');
      expect(response.segments).toHaveLength(2);
      expect(response.segments[0].text).toBe('Hello, world!');
      expect(response.segments[1].text).toBe('How are you?');
    });

    it('should handle doGenerate with language detection', async () => {
      const v2Model = new MockTranscriptionModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          text: 'Bonjour le monde!',
          segments: [
            {
              text: 'Bonjour le monde!',
              startSecond: 0,
              endSecond: 2.5,
            },
          ],
          language: 'fr',
          durationInSeconds: 2.5,
          warnings: [],
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: undefined,
          },
        }),
      });

      const result = asTranscriptionModelV3(v2Model);

      const response = await result.doGenerate({
        audio: new Uint8Array([1, 2, 3]),
        mediaType: 'audio/wav',
      });

      expect(response.language).toBe('fr');
    });

    it('should handle doGenerate with undefined language', async () => {
      const v2Model = new MockTranscriptionModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          text: 'Hello, world!',
          segments: [],
          language: undefined,
          durationInSeconds: 2.5,
          warnings: [],
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: undefined,
          },
        }),
      });

      const result = asTranscriptionModelV3(v2Model);

      const response = await result.doGenerate({
        audio: new Uint8Array([1, 2, 3]),
        mediaType: 'audio/wav',
      });

      expect(response.language).toBeUndefined();
    });

    it('should handle doGenerate with duration information', async () => {
      const v2Model = new MockTranscriptionModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          text: 'Hello, world!',
          segments: [],
          language: 'en',
          durationInSeconds: 10.5,
          warnings: [],
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: undefined,
          },
        }),
      });

      const result = asTranscriptionModelV3(v2Model);

      const response = await result.doGenerate({
        audio: new Uint8Array([1, 2, 3]),
        mediaType: 'audio/wav',
      });

      expect(response.durationInSeconds).toBe(10.5);
    });

    it('should handle doGenerate with undefined duration', async () => {
      const v2Model = new MockTranscriptionModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          text: 'Hello, world!',
          segments: [],
          language: 'en',
          durationInSeconds: undefined,
          warnings: [],
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: undefined,
          },
        }),
      });

      const result = asTranscriptionModelV3(v2Model);

      const response = await result.doGenerate({
        audio: new Uint8Array([1, 2, 3]),
        mediaType: 'audio/wav',
      });

      expect(response.durationInSeconds).toBeUndefined();
    });

    it('should handle doGenerate with warnings', async () => {
      const v2Model = new MockTranscriptionModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          text: 'Hello, world!',
          segments: [],
          language: 'en',
          durationInSeconds: 2.5,
          warnings: [
            {
              type: 'unsupported-setting',
              setting: 'mediaType',
              details: 'Media type not supported',
            },
          ],
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: undefined,
          },
        }),
      });

      const result = asTranscriptionModelV3(v2Model);

      const response = await result.doGenerate({
        audio: new Uint8Array([1, 2, 3]),
        mediaType: 'audio/wav',
      });

      expect(response.warnings).toHaveLength(1);
      expect(response.warnings[0].type).toBe('unsupported-setting');
    });

    it('should handle doGenerate with request metadata', async () => {
      const v2Model = new MockTranscriptionModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          text: 'Hello, world!',
          segments: [],
          language: 'en',
          durationInSeconds: 2.5,
          warnings: [],
          request: {
            body: 'audio-data-string',
          },
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: undefined,
          },
        }),
      });

      const result = asTranscriptionModelV3(v2Model);

      const response = await result.doGenerate({
        audio: new Uint8Array([1, 2, 3]),
        mediaType: 'audio/wav',
      });

      expect(response.request?.body).toBe('audio-data-string');
    });

    it('should handle doGenerate with response headers', async () => {
      const v2Model = new MockTranscriptionModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          text: 'Hello, world!',
          segments: [],
          language: 'en',
          durationInSeconds: 2.5,
          warnings: [],
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: { 'x-custom': 'header-value' },
          },
        }),
      });

      const result = asTranscriptionModelV3(v2Model);

      const response = await result.doGenerate({
        audio: new Uint8Array([1, 2, 3]),
        mediaType: 'audio/wav',
      });

      expect(response.response.headers).toEqual({ 'x-custom': 'header-value' });
    });

    it('should handle doGenerate with response body', async () => {
      const v2Model = new MockTranscriptionModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          text: 'Hello, world!',
          segments: [],
          language: 'en',
          durationInSeconds: 2.5,
          warnings: [],
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: undefined,
            body: { raw: 'response data' },
          },
        }),
      });

      const result = asTranscriptionModelV3(v2Model);

      const response = await result.doGenerate({
        audio: new Uint8Array([1, 2, 3]),
        mediaType: 'audio/wav',
      });

      expect(response.response.body).toEqual({ raw: 'response data' });
    });

    it('should handle doGenerate with provider metadata', async () => {
      const v2Model = new MockTranscriptionModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          text: 'Hello, world!',
          segments: [],
          language: 'en',
          durationInSeconds: 2.5,
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

      const result = asTranscriptionModelV3(v2Model);

      const response = await result.doGenerate({
        audio: new Uint8Array([1, 2, 3]),
        mediaType: 'audio/wav',
      });

      expect(response.providerMetadata?.testProvider).toEqual({
        customField: 'value',
      });
    });

    it('should handle doGenerate with response metadata', async () => {
      const timestamp = new Date();
      const v2Model = new MockTranscriptionModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          text: 'Hello, world!',
          segments: [],
          language: 'en',
          durationInSeconds: 2.5,
          warnings: [],
          response: {
            timestamp,
            modelId: 'actual-model-id',
            headers: undefined,
          },
        }),
      });

      const result = asTranscriptionModelV3(v2Model);

      const response = await result.doGenerate({
        audio: new Uint8Array([1, 2, 3]),
        mediaType: 'audio/wav',
      });

      expect(response.response.timestamp).toBe(timestamp);
      expect(response.response.modelId).toBe('actual-model-id');
    });

    it('should preserve prototype methods when using class instances', async () => {
      class TestTranscriptionModelV2 implements TranscriptionModelV2 {
        readonly specificationVersion = 'v2' as const;
        readonly provider = 'test-provider';
        readonly modelId = 'test-model-id';

        customMethod() {
          return 'custom-value';
        }

        async doGenerate() {
          return {
            text: 'Hello, world!',
            segments: [],
            language: 'en',
            durationInSeconds: 2.5,
            warnings: [],
            response: {
              timestamp: new Date(),
              modelId: 'test-model',
              headers: undefined,
            },
          };
        }
      }

      const v2Model = new TestTranscriptionModelV2();
      const result = asTranscriptionModelV3(v2Model) as any;

      expect(result.customMethod()).toBe('custom-value');
      expect(result.specificationVersion).toBe('v3');
    });
  });
});
