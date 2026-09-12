import { describe, it } from 'vitest';
import transformer from '../codemods/v5/rename-converttocoremessages-to-converttomodelmessages';
import { testTransform } from './test-utils';

describe('rename-converttocoremessages-to-converttomodelmessages', () => {
  it('transforms correctly', () => {
    testTransform(
      transformer,
      'rename-converttocoremessages-to-converttomodelmessages',
    );
  });
});
