import isPlainObject from '../utils/isPlainObject';
import noop from '../utils/noop';

describe('isPlainObject', function () {
  it('should identify plan object or not', function () {
    function test() {
      return {
        test: noop,
      };
    }

    expect(isPlainObject(Object.create({}))).toBeTruthy();
    expect(isPlainObject(Object.create(Object.prototype))).toBeTruthy();
    expect(isPlainObject({ foo: 'bar' })).toBeTruthy();
    expect(isPlainObject({})).toBeTruthy();
    expect(isPlainObject(Object.create(null))).toBeFalsy();
    expect(!isPlainObject(/foo/)).toBeTruthy();
    expect(!isPlainObject(function () {})).toBeTruthy();
    expect(!isPlainObject(['foo', 'bar'])).toBeTruthy();
    expect(!isPlainObject([])).toBeTruthy();
    expect(!isPlainObject(test)).toBeTruthy();
  });
});
