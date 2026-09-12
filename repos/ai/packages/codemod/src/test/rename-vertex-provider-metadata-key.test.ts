import { describe, it } from 'vitest';
import transformer from '../codemods/v6/rename-vertex-provider-metadata-key';
import { testTransform } from './test-utils';

describe('rename-vertex-provider-metadata-key', () => {
  it('transforms google-vertex imports correctly', () => {
    testTransform(transformer, 'rename-vertex-provider-metadata-key');
  });

  it('does not transform files using @ai-sdk/google', () => {
    testTransform(
      transformer,
      'rename-vertex-provider-metadata-key-google-only',
    );
  });
});
