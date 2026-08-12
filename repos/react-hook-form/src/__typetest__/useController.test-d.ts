import { useController } from '../useController';

import type { Equal, Expect, NotEqual } from './__fixtures__';

/** {@link useController} */ {
  /** it should NOT infer never[] when defaultValue is empty array without explicit types */ {
    /* eslint-disable react-hooks/rules-of-hooks */

    const { field } = useController({
      name: 'items' as string,
      defaultValue: [],
    });

    type _t1 = Expect<NotEqual<typeof field.name, never>>;
    type _t2 = Expect<NotEqual<typeof field.value, never[]>>;

    if (Array.isArray(field.value)) {
      field.value.includes('test');
      field.value.push('test');
    }
  }

  /** it should work correctly with explicit type parameters */ {
    /* eslint-disable react-hooks/rules-of-hooks */

    type FormValues = {
      items: string[];
    };

    const { field } = useController<FormValues, 'items'>({
      name: 'items',
      defaultValue: [],
    });

    type _t1 = Expect<Equal<typeof field.value, string[]>>;
    type _t2 = Expect<Equal<typeof field.name, 'items'>>;
  }

  /** it should work with optional array fields */ {
    /* eslint-disable react-hooks/rules-of-hooks */

    type FormValues = {
      optionalItems?: string[];
    };

    const { field } = useController<FormValues, 'optionalItems'>({
      name: 'optionalItems',
      defaultValue: undefined,
    });

    type _t = Expect<Equal<typeof field.value, string[] | undefined>>;
  }

  /** it should work with nested array access */ {
    /* eslint-disable react-hooks/rules-of-hooks */

    type FormValues = {
      nested: {
        items: number[];
      };
    };

    const { field } = useController<FormValues, 'nested.items'>({
      name: 'nested.items',
      defaultValue: [],
    });

    type _t = Expect<Equal<typeof field.value, number[]>>;
  }

  /** it should handle array of objects */ {
    /* eslint-disable react-hooks/rules-of-hooks */

    type FormValues = {
      users: Array<{ id: string; name: string }>;
    };

    const { field } = useController<FormValues, 'users'>({
      name: 'users',
      defaultValue: [],
    });

    type _t = Expect<
      Equal<typeof field.value, Array<{ id: string; name: string }>>
    >;
  }
}
