import unset from '../../utils/unset';

describe('unset', () => {
  it('should unset the array', () => {
    const test = ['test', 'test1', 'test2'];
    expect(unset(test, '[0]')).toEqual([undefined, 'test1', 'test2']);
    expect(unset(test, '[1]')).toEqual([undefined, undefined, 'test2']);
    expect(unset(test, '[2]')).toEqual([undefined, undefined, undefined]);
  });

  it('should return original object when path is not defined', () => {
    const test = {
      test: 'test',
    };

    expect(unset(test, '')).toEqual(test);
  });

  it('should allow unsetting flat keep', () => {
    const test = {
      'test.is.flat': 'test',
      test: {
        'test.is.flat': 'test',
      },
    };

    expect(unset(test, 'test.is.flat')).toEqual({
      test: {
        'test.is.flat': 'test',
      },
    });
  });

  it('should unset the flat object', () => {
    const test = {
      test: 'test',
    };

    expect(unset(test, 'test')).toEqual({});
  });

  it('should not unset if specified field is undefined', () => {
    const test = {
      test: {
        test1: 'test',
      },
    };

    expect(unset(test, 'testDummy.test1')).toEqual({ test: { test1: 'test' } });
  });

  it('should unset the nest object', () => {
    const test = {
      test: {
        min: 'test',
      },
    };

    expect(unset(test, 'test.min')).toEqual({});
  });

  it('should unset deep object', () => {
    const test = {
      test: {
        bill: {
          min: 'test',
        },
      },
    };

    expect(unset(test, 'test.bill.min')).toEqual({});
  });

  it('should unset the including multiple field object', () => {
    const deep = {
      data: {
        firstName: 'test',
        clear: undefined,
        test: [{ data1: '' }, { data2: '' }],
        data: {
          test: undefined,
          test1: {
            ref: {
              test: '',
            },
          },
        },
      },
    };

    const test = {
      test: {
        bill: {
          min: [{ deep }],
        },
        test: 'ha',
      },
    };

    expect(unset(test, 'test.bill.min[0].deep')).toEqual({
      test: {
        test: 'ha',
      },
    });
  });

  it('should unset the object in array', () => {
    const test = {
      test: [{ min: 'required' }],
    };
    expect(unset(test, 'test[0].min')).toEqual({});
  });

  it('should return empty object when inner object is empty object', () => {
    const test = {
      data: {
        firstName: {},
      },
    };

    expect(unset(test, 'data.firstName')).toEqual({});
  });

  it('should clear empty array', () => {
    const test = {
      data: {
        firstName: {
          test: [
            { name: undefined, email: undefined },
            { name: 'test', email: 'last' },
          ],
          deep: {
            last: [
              { name: undefined, email: undefined },
              { name: 'test', email: 'last' },
            ],
          },
        },
      },
    };

    expect(unset(test, 'data.firstName.test[0]')).toEqual({
      data: {
        firstName: {
          test: [undefined, { name: 'test', email: 'last' }],
          deep: {
            last: [
              { name: undefined, email: undefined },
              { name: 'test', email: 'last' },
            ],
          },
        },
      },
    });

    const test2 = {
      arrayItem: [
        {
          test1: undefined,
          test2: undefined,
        },
      ],
      data: 'test',
    };

    expect(unset(test2, 'arrayItem[0].test1')).toEqual({
      arrayItem: [
        {
          test2: undefined,
        },
      ],
      data: 'test',
    });
  });

  it('should only remove relevant data', () => {
    const data = {
      test: {},
      testing: {
        key1: 1,
        key2: [
          {
            key4: 4,
            key5: [],
            key6: null,
            key7: '',
            key8: undefined,
            key9: {},
          },
        ],
        key3: [],
      },
    };

    expect(unset(data, 'test')).toEqual({
      testing: {
        key1: 1,
        key2: [
          {
            key4: 4,
            key5: [],
            key6: null,
            key7: '',
            key8: undefined,
            key9: {},
          },
        ],
        key3: [],
      },
    });
  });

  it('should remove empty array item', () => {
    const data = {
      name: [
        {
          message: 'test',
        },
      ],
    };

    expect(unset(data, 'name[0]')).toEqual({});
  });

  it('should not remove nested empty array item', () => {
    const data = {
      scenario: {
        steps: [
          {
            content: {
              question: 'isRequired',
            },
          },
        ],
      },
    };

    expect(unset(data, 'scenario.steps[1].messages[0]')).toEqual({
      scenario: {
        steps: [
          {
            content: {
              question: 'isRequired',
            },
          },
        ],
      },
    });
  });

  it('should not remove parent if boolean value exists in array', () => {
    const data = {
      test: [true, undefined, true],
    };

    expect(unset(data, 'test[2]')).toEqual({
      test: [true, undefined, undefined],
    });
  });

  it('should reset the array index', () => {
    const data = {
      test: [[{ name: 'test' }], [{ name: 'test1' }]],
    };
    unset(data, 'test.0.0.name');

    expect(data).toEqual({
      test: [undefined, [{ name: 'test1' }]],
    });

    const data1 = {
      test: [[{ name: 'test' }], [{ name: 'test1' }]],
    };
    unset(data1, 'test.1.0.name');

    expect(data1).toEqual({
      test: [[{ name: 'test' }], undefined],
    });

    const data2 = {
      test: [[[{ name: 'test' }]], [{ name: 'test1' }]],
    };
    unset(data2, 'test.0.0.0.name');

    expect(data2).toEqual({
      test: [undefined, [{ name: 'test1' }]],
    });

    const data3 = {
      test: [[[{ name: 'test' }]], [[{ name: 'test1' }]]],
    };
    unset(data3, 'test.1.0.0.name');

    expect(data3).toEqual({
      test: [[[{ name: 'test' }]], undefined],
    });

    const data4 = {
      test: {
        fields: ['1', '2'],
      },
    };
    unset(data4, 'test.fields.1');

    expect(data4).toEqual({
      test: {
        fields: ['1', undefined],
      },
    });
  });

  describe('when there are remaining props', () => {
    it('should not unset the array', () => {
      const test: Record<string, any> = {
        test: [{ firstName: 'test' }],
      };

      test.test.root = {
        test: 'message',
      };

      unset(test, 'test.0.firstName');

      expect(test.test.root).toBeDefined();
    });
  });

  describe('in presence of Array polyfills', () => {
    beforeAll(() => {
      // @ts-expect-error we want to test unset in presence of polyfills
      Array.prototype.somePolyfill = () => 123;
    });

    it('should delete empty arrays', () => {
      const data = {
        prop: [],
      };
      unset(data, 'prop.0');

      expect(data.prop).toBeUndefined();
    });

    afterAll(() => {
      // @ts-expect-error we want to test unset in presence of polyfills
      delete Array.prototype.somePolyfill;
    });
  });
});
