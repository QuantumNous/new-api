import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamResult,
} from '@ai-sdk/provider';
import { notImplemented } from './not-implemented';

export class MockLanguageModelV4 implements LanguageModelV4 {
  readonly specificationVersion = 'v4';

  private _supportedUrls: () => LanguageModelV4['supportedUrls'];

  readonly provider: LanguageModelV4['provider'];
  readonly modelId: LanguageModelV4['modelId'];

  doGenerate: LanguageModelV4['doGenerate'];
  doStream: LanguageModelV4['doStream'];

  doGenerateCalls: LanguageModelV4CallOptions[] = [];
  doStreamCalls: LanguageModelV4CallOptions[] = [];

  constructor({
    provider = 'mock-provider',
    modelId = 'mock-model-id',
    supportedUrls = {},
    doGenerate = notImplemented,
    doStream = notImplemented,
  }: {
    provider?: LanguageModelV4['provider'];
    modelId?: LanguageModelV4['modelId'];
    supportedUrls?:
      | LanguageModelV4['supportedUrls']
      | (() => LanguageModelV4['supportedUrls']);
    doGenerate?:
      | LanguageModelV4['doGenerate']
      | LanguageModelV4GenerateResult
      | LanguageModelV4GenerateResult[];
    doStream?:
      | LanguageModelV4['doStream']
      | LanguageModelV4StreamResult
      | LanguageModelV4StreamResult[];
  } = {}) {
    this.provider = provider;
    this.modelId = modelId;
    this.doGenerate = async options => {
      this.doGenerateCalls.push(options);

      if (typeof doGenerate === 'function') {
        return await doGenerate(options);
      } else if (Array.isArray(doGenerate)) {
        return doGenerate[this.doGenerateCalls.length - 1];
      } else {
        return doGenerate;
      }
    };
    this.doStream = async options => {
      this.doStreamCalls.push(options);

      if (typeof doStream === 'function') {
        return await doStream(options);
      } else if (Array.isArray(doStream)) {
        return doStream[this.doStreamCalls.length - 1];
      } else {
        return doStream;
      }
    };
    this._supportedUrls =
      typeof supportedUrls === 'function'
        ? supportedUrls
        : async () => await supportedUrls;
  }

  get supportedUrls() {
    return this._supportedUrls();
  }
}
