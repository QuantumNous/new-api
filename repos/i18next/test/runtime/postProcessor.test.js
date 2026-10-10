import { describe, it, expect, beforeAll } from 'vitest';
import postProcessor from '../../src/postProcessor';

describe('postProcessor', () => {
  describe('add and handle()', () => {
    beforeAll(() => {
      postProcessor.addPostProcessor({
        name: 'dummy',
        process: (value) => value.toUpperCase(),
      });
    });

    const tests = [{ args: [['dummy'], 'test', 'key', {}, () => {}], expected: 'TEST' }];

    tests.forEach((test) => {
      it(`correctly process for ${JSON.stringify(test.args)} args`, () => {
        expect(postProcessor.handle.apply(postProcessor, test.args)).to.eql(test.expected);
      });
    });
  });
});
