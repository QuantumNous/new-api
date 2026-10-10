import schemaErrorLookup from '../../logic/schemaErrorLookup';

describe('errorsLookup', () => {
  it('should be able to look up the error', () => {
    expect(
      schemaErrorLookup<{
        test: {
          deep: string;
        };
      }>(
        {
          test: {
            type: 'test',
            message: 'error',
            deep: {
              type: 'deep',
              message: 'error',
            },
          },
        },
        {},
        'test.deep.whatever',
      ),
    ).toEqual({
      error: {
        type: 'deep',
        message: 'error',
      },
      name: 'test.deep',
    });

    expect(
      schemaErrorLookup(
        {
          test: {
            type: 'test',
            message: 'error',
          },
        },
        {},
        'test.0.whatever',
      ),
    ).toEqual({
      error: {
        type: 'test',
        message: 'error',
      },
      name: 'test',
    });

    expect(
      schemaErrorLookup(
        {
          test: {
            type: 'test',
            message: 'error',
          },
        },
        {},
        'test',
      ),
    ).toEqual({
      error: {
        type: 'test',
        message: 'error',
      },
      name: 'test',
    });

    expect(
      schemaErrorLookup<{
        test: {
          deep: string;
        };
        test1: {
          nested: {
            deepNested: string;
          };
        };
      }>(
        {
          test: {
            type: 'test',
            message: 'error',
          },
          test1: {
            type: 'test',
            message: 'error',
            nested: {
              type: 'test',
              message: 'error',
              deepNested: {
                type: 'deepNested',
                message: 'error',
              },
            },
          },
        },
        {},
        'test1.nested.deepNested.whatever',
      ),
    ).toEqual({
      error: { message: 'error', type: 'deepNested' },
      name: 'test1.nested.deepNested',
    });
  });

  it('should return undefined when not found', () => {
    expect(
      schemaErrorLookup(
        {
          test: {
            type: 'test',
            message: 'error',
          },
        },
        {},
        'test1234',
      ),
    ).toEqual({ error: undefined, name: 'test1234' });

    expect(
      schemaErrorLookup(
        {
          test: {
            type: 'test',
            message: 'error',
          },
        },
        {},
        'testX.1.test',
      ),
    ).toEqual({
      name: 'testX.1.test',
    });

    expect(
      schemaErrorLookup<{
        test: {
          test: string;
          test1: string;
        };
      }>(
        {
          test: {
            test: {
              type: 'test',
              message: 'error',
            },
            test1: {
              type: 'test',
              message: 'error',
            },
          },
        },
        {},
        'test.test2',
      ),
    ).toEqual({
      name: 'test.test2',
    });
  });

  it('should prevent error from reported when field is identified', () => {
    expect(
      schemaErrorLookup<{
        test: {
          test: string;
          test1: string;
        };
      }>(
        {
          test: {
            test: {
              type: 'test',
              message: 'error',
            },
            test1: {
              type: 'test',
              message: 'error',
            },
          },
        },
        {
          test: {
            test1: {
              _f: {
                ref: {},
                name: 'test',
              },
            },
          },
        },
        'test.test1.whatever',
      ),
    ).toEqual({
      name: 'test.test1.whatever',
    });

    expect(
      schemaErrorLookup<{
        test: {
          test: string;
          test1: string;
        };
      }>(
        {
          test: {
            test: {
              type: 'test',
              message: 'error',
            },
            test1: {
              type: 'test',
              message: 'error',
            },
          },
        },
        {
          test: {
            test1: {
              _f: {
                ref: {},
                name: 'test',
              },
            },
          },
        },
        'test.testXYZ',
      ),
    ).toEqual({
      name: 'test.testXYZ',
    });
  });

  it('should find the nearest root error', () => {
    const errors = {
      test: {
        0: {
          root: {
            type: 'root',
            message: 'higher-root',
          },
          nested: {
            root: {
              type: 'root',
              message: 'correct-root',
            },
            0: {
              deepNested: {
                type: 'deepNested',
                message: 'error',
              },
            },
          },
        },
      },
    };

    expect(
      schemaErrorLookup<{ test: { nested: { deepNested: string }[] }[] }>(
        errors,
        {},
        'test.0.nested.1',
      ),
    ).toEqual({
      error: { message: 'correct-root', type: 'root' },
      name: 'test.0.nested.root',
    });

    expect(
      schemaErrorLookup<{ test: { nested: { deepNested: string }[] }[] }>(
        errors,
        {},
        'test.0.nested.0.deepNested',
      ),
    ).toEqual({
      error: { message: 'error', type: 'deepNested' },
      name: 'test.0.nested.0.deepNested',
    });
  });
});
