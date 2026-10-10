import isWatched from '../../logic/isWatched';

describe('isWatched', () => {
  it('should return watched fields', () => {
    expect(
      isWatched('', {
        registerName: new Set(),
        mount: new Set(),
        disabled: new Set(),
        unMount: new Set(),
        array: new Set(),
        watch: new Set(),
        focus: '',
        watchAll: true,
      }),
    ).toBeTruthy();

    expect(
      isWatched('test', {
        registerName: new Set(),
        mount: new Set(),
        disabled: new Set(),
        unMount: new Set(),
        array: new Set(),
        watch: new Set(['test']),
        focus: '',
        watchAll: false,
      }),
    ).toBeTruthy();
  });

  it('should return true when watched with parent node', () => {
    expect(
      isWatched('test.test', {
        registerName: new Set(),
        mount: new Set(),
        disabled: new Set(),
        unMount: new Set(),
        array: new Set(),
        watch: new Set(['test']),
        focus: '',
        watchAll: false,
      }),
    ).toBeTruthy();

    expect(
      isWatched('test.test.test', {
        registerName: new Set(),
        mount: new Set(),
        disabled: new Set(),
        unMount: new Set(),
        array: new Set(),
        watch: new Set(['test.test']),
        focus: '',
        watchAll: false,
      }),
    ).toBeTruthy();

    expect(
      isWatched('test.test.test', {
        registerName: new Set(),
        mount: new Set(),
        disabled: new Set(),
        unMount: new Set(),
        array: new Set(),
        watch: new Set(['testFail.test', 'test.test']),
        focus: '',
        watchAll: false,
      }),
    ).toBeTruthy();

    expect(
      isWatched('test.0', {
        registerName: new Set(),
        mount: new Set(),
        disabled: new Set(),
        unMount: new Set(),
        array: new Set(),
        watch: new Set(['test']),
        focus: '',
        watchAll: false,
      }),
    ).toBeTruthy();

    expect(
      isWatched('test.0.test', {
        registerName: new Set(),
        mount: new Set(),
        disabled: new Set(),
        unMount: new Set(),
        array: new Set(),
        watch: new Set(['test.0']),
        focus: '',
        watchAll: false,
      }),
    ).toBeTruthy();
  });

  it("should return false when watched with parent node that doesn't match child name", () => {
    expect(
      isWatched('test.test.test', {
        registerName: new Set(),
        mount: new Set(),
        disabled: new Set(),
        unMount: new Set(),
        array: new Set(),
        watch: new Set(['tesk.test']),
        focus: '',
        watchAll: false,
      }),
    ).toBeFalsy();

    expect(
      isWatched('test.test.test', {
        mount: new Set(),
        disabled: new Set(),
        unMount: new Set(),
        array: new Set(),
        registerName: new Set(),
        watch: new Set(['testFail.test']),
        focus: '',
        watchAll: false,
      }),
    ).toBeFalsy();
  });

  it('returns true on first prefix match without iterating the full Set', () => {
    const watch = new Set(['a', 'b', 'c', 'd', 'e']);

    expect(
      isWatched('a.child', {
        registerName: new Set(),
        mount: new Set(),
        disabled: new Set(),
        unMount: new Set(),
        array: new Set(),
        watch,
        focus: '',
        watchAll: false,
      }),
    ).toBeTruthy();

    expect(
      isWatched('e.child', {
        registerName: new Set(),
        mount: new Set(),
        disabled: new Set(),
        unMount: new Set(),
        array: new Set(),
        watch,
        focus: '',
        watchAll: false,
      }),
    ).toBeTruthy();

    expect(
      isWatched('z.child', {
        registerName: new Set(),
        mount: new Set(),
        disabled: new Set(),
        unMount: new Set(),
        array: new Set(),
        watch,
        focus: '',
        watchAll: false,
      }),
    ).toBeFalsy();
  });

  it('should return falsy for blur event', () => {
    expect(
      isWatched(
        '',
        {
          mount: new Set(),
          disabled: new Set(),
          registerName: new Set(),
          unMount: new Set(),
          array: new Set(),
          watch: new Set(),
          focus: '',
          watchAll: true,
        },
        true,
      ),
    ).toBeFalsy();
  });
});
