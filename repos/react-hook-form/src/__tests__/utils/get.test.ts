import get from '../../utils/get';

describe('get', () => {
  it('should get the right data', () => {
    const test = {
      bill: [1, 2, 3],
      luo: [1, 3, { betty: 'test' }],
      betty: { test: { test1: [{ test2: 'bill' }] } },
      'betty.test.test1[0].test1': 'test',
      'dotted.filled': 'content',
      'dotted.empty': '',
    };
    expect(get(test, 'bill')).toEqual([1, 2, 3]);
    expect(get(test, 'bill[0]')).toEqual(1);
    expect(get(test, 'luo[2].betty')).toEqual('test');
    expect(get(test, 'betty.test.test1[0].test2')).toEqual('bill');
    expect(get(test, 'betty.test.test1[0].test1')).toEqual('test');
    expect(get(test, 'betty.test.test1[0].test3')).toEqual(undefined);
    expect(get(test, 'dotted.filled')).toEqual(test['dotted.filled']);
    expect(get(test, 'dotted.empty')).toEqual(test['dotted.empty']);
    expect(get(test, 'dotted.nonexistent', 'default')).toEqual('default');
  });

  it('should get from the flat data', () => {
    const test = {
      bill: 'test',
    };
    expect(get(test, 'bill')).toEqual('test');
  });

  it('should return undefined when provided with empty path', () => {
    const test = {
      bill: 'test',
    };
    expect(get(test, '')).toEqual(undefined);
    expect(get(test, undefined)).toEqual(undefined);
    expect(get(test, null)).toEqual(undefined);
  });

  it('should retrieve values from path containing quotes', () => {
    const object = {
      'Im with single quote!': {
        _f: {
          name: "I'm with single quote!",
          mount: true,
          required: true,
        },
      },
      'With  dobule quote': {
        _f: {
          name: 'With " dobule quote',
          mount: true,
          required: true,
        },
      },
    };

    expect(get(object, "I'm with single quote!")).toEqual(undefined);

    expect(get(object, 'With " dobule quote')).toEqual(undefined);
  });

  it('should not retrieve prototype properties through path traversal', () => {
    const pollutedKey = '__reactHookFormPolluted__';
    const object = { name: 'John' };

    Object.prototype[pollutedKey] = 'SECRET_DATA';

    expect(get(object, `__proto__.${pollutedKey}`, 'default')).toBe('default');
    expect(get(object, `__proto__[${pollutedKey}]`, 'default')).toBe('default');

    delete Object.prototype[pollutedKey];
  });

  describe('get - preserveNull option', () => {
    const obj = {
      a: {
        b: null,
      },
    };

    it('preserveNull = true (default): null is preserved through traversal', () => {
      const result = get(obj, 'a.b', 'DEFAULT');

      expect(result).toBeNull();
    });

    it('preserveNull = true: nested access after null does not break early', () => {
      const result = get(obj, 'a.b.c', 'DEFAULT');

      expect(result).toBe('DEFAULT');
    });

    it('preserveNull = false: null is treated as missing and triggers default', () => {
      const result = get(obj, 'a.b.c', 'DEFAULT');

      expect(result).toBe('DEFAULT');
    });

    it('preserveNull = false: direct null value is treated as missing', () => {
      const result = get(obj, 'a.b', 'DEFAULT');

      expect(result).toBeNull();
    });
  });
});
