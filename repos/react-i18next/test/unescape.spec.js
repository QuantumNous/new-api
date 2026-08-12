import { describe, it, expect } from 'vitest';
import { unescape } from '../src/unescape';

describe('unescape', () => {
  /** @type {[string, string]} */
  const testCases = [
    ['&amp;', '&'],
    ['&#38;', '&'],
    ['&lt;', '<'],
    ['&#60;', '<'],
    ['&gt;', '>'],
    ['&#62;', '>'],
    ['&apos;', "'"],
    ['&#39;', "'"],
    ['&quot;', '"'],
    ['&#34;', '"'],
    ['&nbsp;', ' '],
    ['&#160;', ' '],
    ['&copy;', '©'],
    ['&#169;', '©'],
    ['&reg;', '®'],
    ['&#174;', '®'],
    ['&hellip;', '…'],
    ['&#8230;', '…'],
    ['&#x2F;', '/'],
    ['&#47;', '/'],
  ];

  testCases.forEach(([value, expected]) => {
    it(`should unescape "${value}" to "${expected}"`, () => {
      expect(unescape(value)).toStrictEqual(expected);
    });
  });

  it('should unescape long strings', () => {
    expect(unescape(testCases.map((test) => test[0]).join(' '))).toStrictEqual(
      testCases.map((test) => test[1]).join(' '),
    );
  });
});
