import { useForm } from '../useForm';
import { Watch } from '../watch';

import type { Equal, Expect } from './__fixtures__';

type FormData = {
  foo: string;
  bar: string;
  baz: {
    qux: string;
  };
  quux: number;
  fie: null;
  foe: { qux: number[] };
};

/** {@link Watch} */ {
  /** it should have correct types for render function parameter when names is passed as array */ {
    /* eslint-disable react-hooks/rules-of-hooks */
    const { control } = useForm<FormData>();

    void Watch({
      control,
      names: ['foo', 'fie', 'quux', 'baz', 'baz.qux'],
      render: (values) => {
        type _t = Expect<
          Equal<typeof values, [string, null, number, { qux: string }, string]>
        >;
        return null;
      },
    });
  }

  /** it should have correct types for render function parameter when names is passed as string */ {
    /* eslint-disable react-hooks/rules-of-hooks */
    const { control } = useForm<FormData>();

    void Watch({
      control,
      names: 'baz.qux',
      render: (value) => {
        type _t = Expect<Equal<typeof value, string>>;
        return null;
      },
    });
  }

  /** it should have correct types for render function parameter when names omitted */ {
    /* eslint-disable react-hooks/rules-of-hooks */
    const { control } = useForm<FormData>();

    void Watch({
      control,
      render: (value) => {
        type _t = Expect<Equal<typeof value, FormData>>;
        return null;
      },
    });
  }

  /** it should have correct types for render function parameter when compute is used */ {
    /* eslint-disable react-hooks/rules-of-hooks */
    const { control } = useForm<FormData>();

    void Watch({
      control,
      names: 'baz.qux',
      compute: (val) => val.length > 2,
      render: (value) => {
        type _t = Expect<Equal<typeof value, boolean>>;
        return null;
      },
    });
  }

  /** it should have correct types for compute function parameter when names is passed as string */ {
    /* eslint-disable react-hooks/rules-of-hooks */
    const { control } = useForm<FormData>();

    void Watch({
      control,
      names: 'baz.qux',
      compute: (val) => {
        type _t = Expect<Equal<typeof val, string>>;
        return val;
      },
      render: () => null,
    });
  }

  /** it should have correct types for compute function parameter when names is passed as array */ {
    /* eslint-disable react-hooks/rules-of-hooks */
    const { control } = useForm<FormData>();

    void Watch({
      control,
      names: ['baz.qux', 'fie', 'quux'],
      compute: (val) => {
        type _t = Expect<Equal<typeof val, [string, null, number]>>;
        return val;
      },
      render: () => null,
    });
  }

  /** it should have correct types for compute function parameter when name is omitted */ {
    /* eslint-disable react-hooks/rules-of-hooks */
    const { control } = useForm<FormData>();

    void Watch({
      control,
      compute: (val) => {
        type _t = Expect<Equal<typeof val, FormData>>;
        return val;
      },
      render: () => null,
    });
  }
}
