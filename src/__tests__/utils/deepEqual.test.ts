import deepEqual from '../../utils/deepEqual';

describe('deepEqual', () => {
  it('should return false when two sets not match', () => {
    expect(
      deepEqual([{ test: '123' }, { test: '455' }, { test: '455' }], []),
    ).toBeFalsy();

    expect(
      deepEqual(
        [{ test: '123' }, { test: '455' }, { test: '455' }],
        [{ test: '123' }, { test: '455' }, { test: '455', test1: 'what' }],
      ),
    ).toBeFalsy();

    expect(deepEqual([{}], [])).toBeFalsy();

    expect(deepEqual([], [{}])).toBeFalsy();
    expect(deepEqual(new Date(), new Date('1999'))).toBeFalsy();

    expect(
      deepEqual(
        {
          unknown: undefined,
          userName: '',
          fruit: '',
        },
        {
          userName: '',
          fruit: '',
          break: {},
        },
      ),
    ).toBeFalsy();
  });

  it('should return false when either type is primitive', () => {
    expect(deepEqual(null, [])).toBeFalsy();
    expect(deepEqual([], null)).toBeFalsy();
    expect(deepEqual({}, undefined)).toBeFalsy();
    expect(deepEqual(undefined, {})).toBeFalsy();
  });

  it('should return true when two sets matches', () => {
    expect(
      deepEqual([{ name: 'useFieldArray' }], [{ name: 'useFieldArray' }]),
    ).toBeTruthy();

    expect(
      deepEqual(
        [{ test: '123' }, { test: '455' }, { test: '455' }],
        [{ test: '123' }, { test: '455' }, { test: '455' }],
      ),
    ).toBeTruthy();

    expect(deepEqual({}, {})).toBeTruthy();

    expect(deepEqual([], [])).toBeTruthy();

    expect(
      deepEqual(
        [{ test: '123' }, { test: '455' }],
        [{ test: '123' }, { test: '455' }],
      ),
    ).toBeTruthy();

    expect(
      deepEqual(
        [
          {
            test: '123',
            nestedArray: [{ test: '123' }, { test: '455' }, { test: '455' }],
          },
          {
            test: '455',
            nestedArray: [{ test: '123' }, { test: '455' }, { test: '455' }],
          },
        ],
        [
          {
            test: '123',
            nestedArray: [{ test: '123' }, { test: '455' }, { test: '455' }],
          },
          {
            test: '455',
            nestedArray: [{ test: '123' }, { test: '455' }, { test: '455' }],
          },
        ],
      ),
    ).toBeTruthy();
  });

  it('should return true when comparing sparse array against plain object with numeric string keys (issue #13346)', () => {
    const sparseArray: any[] = [];
    sparseArray[123] = { name: 'Alice' };
    sparseArray[456] = { name: 'Bob' };

    const plainObject: any = {
      '123': { name: 'Alice' },
      '456': { name: 'Bob' },
    };

    expect(deepEqual(sparseArray, plainObject)).toBeTruthy();
    expect(deepEqual(plainObject, sparseArray)).toBeTruthy();

    expect(
      deepEqual({ items: sparseArray }, { items: plainObject }),
    ).toBeTruthy();
    expect(
      deepEqual({ items: plainObject }, { items: sparseArray }),
    ).toBeTruthy();
  });

  it('should compare date time object valueOf', () => {
    expect(
      deepEqual({ test: new Date('1990') }, { test: new Date('1990') }),
    ).toBeTruthy();
  });

  it('should return true when comparing invalid Date objects', () => {
    expect(deepEqual(new Date('invalid'), new Date('abc'))).toBeTruthy();
  });

  it('should be capable of comparing objects with circular references', () => {
    const a: any = { test: '123' };
    const b: any = { test: '123' };
    a.self = a;
    b.self = b;

    expect(deepEqual(a, b)).toBeTruthy();

    a.other = { test: '123' };
    b.other = { test: '456' };

    expect(deepEqual(a, b)).toBeFalsy();

    b.other.test = '123';

    a.other.parent = b;
    b.other.parent = a;

    expect(deepEqual(a, b)).toBeTruthy();

    b.other.parent = a.other;

    expect(deepEqual(a, b)).toBeFalsy();
  });

  it('should not treat different values as equal when one side reuses an object reference', () => {
    const shared = { value: 1 };

    expect(
      deepEqual(
        { first: shared, second: shared },
        { first: { value: 1 }, second: { value: 2 } },
      ),
    ).toBeFalsy();

    expect(
      deepEqual(
        { first: { value: 1 }, second: { value: 2 } },
        { first: shared, second: shared },
      ),
    ).toBeFalsy();

    expect(
      deepEqual([shared, shared], [{ value: 1 }, { value: 9 }]),
    ).toBeFalsy();

    expect(
      deepEqual(
        { first: shared, second: shared },
        { first: { value: 1 }, second: { value: 1 } },
      ),
    ).toBeTruthy();
  });

  it('should return true when comparing NaN values', () => {
    expect(deepEqual(NaN, NaN)).toBeTruthy();

    // Object NaN
    expect(deepEqual({ value: NaN }, { value: NaN })).toBeTruthy();

    // Array NaN
    expect(deepEqual([NaN], [NaN])).toBeTruthy();

    // Nested Structures NaN
    expect(
      deepEqual(
        { user: { age: NaN, name: 'test' } },
        { user: { age: NaN, name: 'test' } },
      ),
    ).toBeTruthy();

    // Mixed with other values
    expect(
      deepEqual({ a: NaN, b: 1, c: 'test' }, { a: NaN, b: 1, c: 'test' }),
    ).toBeTruthy();
  });

  it('should return false when comparing NaN with other values', () => {
    expect(deepEqual({ value: NaN }, { value: 0 })).toBeFalsy();
    expect(deepEqual({ value: NaN }, { value: undefined })).toBeFalsy();
    expect(deepEqual({ value: NaN }, { value: null })).toBeFalsy();
    expect(deepEqual({ value: NaN }, { value: 'NaN' })).toBeFalsy();
    expect(deepEqual([NaN], [0])).toBeFalsy();
  });

  it('should compare empty non-plain objects by reference', () => {
    class EmptyObject {}

    const file = new File(['a'], 'a.svg', { type: 'image/svg+xml' });

    expect(deepEqual(file, file)).toBeTruthy();
    expect(
      deepEqual(file, new File(['b'], 'b.jpg', { type: 'image/jpeg' })),
    ).toBeFalsy();
    expect(deepEqual(new Blob(['a']), new Blob(['a']))).toBeFalsy();
    expect(deepEqual(new FormData(), new FormData())).toBeFalsy();
    expect(
      deepEqual(new Map([['test', '1']]), new Map([['test', '1']])),
    ).toBeFalsy();
    expect(deepEqual(new Set(['test']), new Set(['test']))).toBeFalsy();
    expect(deepEqual(new EmptyObject(), new EmptyObject())).toBeFalsy();
  });

  it('should return false when comparing an empty array with an empty plain object', () => {
    expect(deepEqual([], {})).toBeFalsy();
    expect(deepEqual({}, [])).toBeFalsy();
    expect(deepEqual({ items: [] }, { items: {} })).toBeFalsy();
    expect(deepEqual({ items: {} }, { items: [] })).toBeFalsy();
  });
});
