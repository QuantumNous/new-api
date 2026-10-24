import { describe, it } from 'vitest';
import transformer from '../codemods/v6/rename-converttocoremessages-to-converttomodelmessages';
import { testTransform } from './test-utils';

describe('rename-converttocoremessages-to-converttomodelmessages (v6)', () => {
  it('transforms correctly', () => {
    testTransform(
      transformer,
      'rename-converttocoremessages-to-converttomodelmessages',
    );
  });
});
