import { describe, it } from 'vitest';
import transformer from '../codemods/v7/rename-experimental-telemetry-to-telemetry';
import { testTransform } from './test-utils';

describe('rename-experimental-telemetry-to-telemetry', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'rename-experimental-telemetry-to-telemetry');
  });
});
