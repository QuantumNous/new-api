import { getModelPath } from './get-model-path';
import { it, expect } from 'vitest';

it('should pass through model path for models/*', async () => {
  expect(getModelPath('models/some-model')).toEqual('models/some-model');
});

it('should pass through model path for tunedModels/*', async () => {
  expect(getModelPath('tunedModels/some-model')).toEqual(
    'tunedModels/some-model',
  );
});

it('should add model path prefix to models without slash', async () => {
  expect(getModelPath('some-model')).toEqual('models/some-model');
});
