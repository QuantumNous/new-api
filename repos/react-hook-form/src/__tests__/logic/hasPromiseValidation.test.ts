import hasPromiseValidation from '../../logic/hasPromiseValidation';

const commonParam = {
  mount: true,
  name: 'test1',
  ref: {
    name: 'test1',
    value: '',
  },
};

describe('hasPromiseValidation', () => {
  it('validate option does not exist', () => {
    expect(hasPromiseValidation(commonParam)).toEqual(false);
  });
  it('should return true when validate option has a function type value and is an async function', () => {
    const param = {
      ...commonParam,
      validate: async () => {
        return true;
      },
    };

    expect(hasPromiseValidation(param)).toEqual(true);
  });
  it('should return false when validate option has a function type value and is not an async function', () => {
    const param = {
      ...commonParam,
      validate: () => {
        return true;
      },
    };

    expect(hasPromiseValidation(param)).toEqual(false);
  });
  it('should return true when validate option has an object type value, and the values of all properties are async function.', () => {
    const param = {
      ...commonParam,
      validate: {
        positive: async (v: string) => parseInt(v) > 0,
        lessThanTen: async (v: string) => parseInt(v) < 10,
      },
    };

    expect(hasPromiseValidation(param)).toEqual(true);
  });
  it('should return true when validate option has an object type value, and the value of one property is an async function.', () => {
    const param = {
      ...commonParam,
      validate: {
        positive: (v: string) => parseInt(v) > 0,
        lessThanTen: async (v: string) => parseInt(v) < 10,
      },
    };

    expect(hasPromiseValidation(param)).toEqual(true);
  });
  it('should return false when validate option has an object type value, and the values of all properties are not async function.', () => {
    const param = {
      ...commonParam,
      validate: {
        positive: (v: string) => parseInt(v) > 0,
        lessThanTen: (v: string) => parseInt(v) < 10,
      },
    };

    expect(hasPromiseValidation(param)).toEqual(false);
  });
});
