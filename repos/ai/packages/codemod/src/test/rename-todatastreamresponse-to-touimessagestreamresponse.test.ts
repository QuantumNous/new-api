import { describe, it } from 'vitest';
import transformer from '../codemods/v5/rename-todatastreamresponse-to-touimessagestreamresponse';
import { testTransform } from './test-utils';

describe('rename-todatastreamresponse-to-touimessagestreamresponse', () => {
  it('transforms correctly', () => {
    testTransform(
      transformer,
      'rename-todatastreamresponse-to-touimessagestreamresponse',
    );
  });
});
