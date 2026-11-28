import { describe, it } from 'vitest';
import transformer from '../codemods/v5/rename-pipedatastreamtoresponse-to-pipeuimessagestreamtoresponse';
import { testTransform } from './test-utils';

describe('rename-pipedatastreamtoresponse-to-pipeuimessagestreamtoresponse', () => {
  it('transforms correctly', () => {
    testTransform(
      transformer,
      'rename-pipedatastreamtoresponse-to-pipeuimessagestreamtoresponse',
    );
  });
});
