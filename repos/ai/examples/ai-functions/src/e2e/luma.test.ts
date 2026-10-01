import { expect } from 'vitest';
import { luma as provider, type LumaErrorData } from '@ai-sdk/luma';
import type { APICallError } from '@ai-sdk/provider';
import {
  createFeatureTestSuite,
  createImageModelWithCapabilities,
} from './feature-test-suite';
import 'dotenv/config';

createFeatureTestSuite({
  name: 'Luma',
  models: {
    invalidImageModel: provider.image('no-such-model'),
    imageModels: [
      createImageModelWithCapabilities(provider.image('photon-flash-1')),
      createImageModelWithCapabilities(provider.image('photon-1')),
    ],
  },
  timeout: 30000,
  customAssertions: {
    errorValidator: (error: APICallError) => {
      expect((error.data as LumaErrorData).detail[0].msg).toMatch(
        /Input should be/i,
      );
    },
  },
})();
