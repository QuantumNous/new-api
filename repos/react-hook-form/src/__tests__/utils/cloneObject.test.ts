import cloneObject from '../../utils/cloneObject';
import noop from '../../utils/noop';

describe('clone', () => {
  it('should clone object and not mutate the original object', () => {
    const fileData = new File([''], 'filename');
    const data: Record<string, any> = {
      items: [],
      test: {
        date: new Date('2020-10-15'),
        test0: 12,
        test1: '12',
        test2: [1, 2, 3, 4],
        deep: {
          date: new Date('2020-10-15'),
          test0: 12,
          test1: '12',
          test2: [
            1,
            2,
            3,
            4,
            {
              file: fileData,
            },
          ],
          file: fileData,
        },
      },
      file: fileData,
      test2: new Set([1, 2]),
      test1: new Map([
        [1, 'one'],
        [2, 'two'],
        [3, 'three'],
      ]),
    };

    const copy = cloneObject(data);
    expect(cloneObject(data)).toEqual(copy);

    copy.test.what = '1243';
    copy.test.date = new Date('2020-10-16');
    copy.items[0] = 2;

    expect(data).toEqual({
      items: [],
      test: {
        date: new Date('2020-10-15'),
        test0: 12,
        test1: '12',
        test2: [1, 2, 3, 4],
        deep: {
          date: new Date('2020-10-15'),
          test0: 12,
          test1: '12',
          test2: [
            1,
            2,
            3,
            4,
            {
              file: fileData,
            },
          ],
          file: fileData,
        },
      },
      file: fileData,
      test2: new Set([1, 2]),
      test1: new Map([
        [1, 'one'],
        [2, 'two'],
        [3, 'three'],
      ]),
    });

    data.items = [1, 2, 3];

    expect(copy.items).toEqual([2]);
  });

  it('should skip clone if a node is instance of function', () => {
    const data = {
      test: {
        testFunction: noop,
        test: 'inner-string',
        deep: {
          testFunction: noop,
          test: 'deep-string',
        },
      },
      testFunction: noop,
      other: 'string',
    };

    const copy = cloneObject(data);
    data.test.deep.test = 'changed-deep-string';

    expect(copy).toEqual({
      test: {
        test: 'inner-string',
        deep: {
          testFunction: noop,
          test: 'deep-string',
        },
        testFunction: noop,
      },
      testFunction: noop,
      other: 'string',
    });
  });

  it('should skip clone if a node is not planeObject', () => {
    class Foo {
      a = 1;
      b = 1;

      static c = function () {};
    }

    const object = new Foo();
    const copy = cloneObject(object);

    expect(copy).toBe(object);
  });

  describe('FileList not defined', () => {
    const fileList = globalThis.FileList;

    beforeAll(() => {
      // @ts-expect-error we want to test that clone skips if FileList is not defined.
      delete globalThis.FileList;
    });

    afterAll(() => {
      globalThis.FileList = fileList;
    });

    it('should skip clone if FileList is not defined', () => {
      const data = {
        a: 1,
        b: 2,
      };
      const copy = cloneObject(data);

      expect(copy).toEqual(data);
    });
  });

  describe('in presence of Array polyfills', () => {
    beforeAll(() => {
      // @ts-expect-error we want to test that clone skips polyfill
      Array.prototype.somePolyfill = () => 123;
    });

    it('should skip polyfills while cloning', () => {
      const data = [1];
      const copy = cloneObject(data);

      expect(Object.hasOwn(copy, 'somePolyfill')).toBe(false);
    });

    afterAll(() => {
      // @ts-expect-error we want to test that clone skips polyfill
      delete Array.prototype.somePolyfill;
    });
  });

  it('should not override prototype of nested object', () => {
    const UtcProto = {
      _tag: 'Utc',
    };
    const formValues = {
      dateTime: Object.create(UtcProto),
    };
    const copy = cloneObject(formValues);
    expect(Object.getPrototypeOf(copy.dateTime)).toEqual(UtcProto);
    expect(copy.dateTime._tag).toBe('Utc');
  });

  it('should not override prototype of nested object', () => {
    const UtcProto = {
      _tag: 'Utc',
    };
    const dateTime = Object.create(UtcProto);
    const copy = cloneObject(dateTime);
    expect(copy._tag).toBe('Utc');
  });
});
