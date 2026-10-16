// types/__tests__/formState.tsd.ts
import { FormStateSubscribe } from '../formStateSubscribe';
import type { FieldValues } from '../types';
import { type UseFormStateReturn } from '../types';
import { useForm } from '../useForm';

import type { Equal, Expect } from './__fixtures__';

/** {@link FormState} */ {
  type FormType = {
    foo: string;
    bar: string;
    baz: { qux: string };
    quux: number;
    fie: null;
    foe: { qux: number[] };
    items: { myField: string; myOtherField: string }[];
  };

  /** it should type the render function parameter as UseFormStateReturn<TFieldValues> */ {
    /* eslint-disable react-hooks/rules-of-hooks */
    const { control } = useForm<FormType>();

    void FormStateSubscribe({
      control,
      render: (state) => {
        // Whole object
        type _t1 = Expect<Equal<typeof state, UseFormStateReturn<FormType>>>;

        // Common scalars
        type _t2 = Expect<Equal<typeof state.isDirty, boolean>>;
        type _t3 = Expect<Equal<typeof state.isValid, boolean>>;
        type _t4 = Expect<Equal<typeof state.isValidating, boolean>>;
        type _t5 = Expect<Equal<typeof state.submitCount, number>>;
        type _t6 = Expect<Equal<typeof state.disabled, boolean>>;

        // Errors shape
        const errFooMsg = state.errors.foo?.message;
        const errBazQuxMsg = state.errors.baz?.qux?.message;
        const errFoeQux0Msg = state.errors.foe?.qux?.[0]?.message;
        type _t7 = Expect<Equal<typeof errFooMsg, string | undefined>>;
        type _t8 = Expect<Equal<typeof errBazQuxMsg, string | undefined>>;
        type _t9 = Expect<Equal<typeof errFoeQux0Msg, string | undefined>>;

        // Dirty fields map (nested booleans)
        type _t10 = Expect<
          Equal<typeof state.dirtyFields.foo, boolean | undefined>
        >;
        const dirtyBazQux = state.dirtyFields.baz?.qux;
        type _t11 = Expect<Equal<typeof dirtyBazQux, boolean | undefined>>;
        type _t11b = Expect<
          Equal<
            typeof state.dirtyFields.items,
            | (
                | {
                    myField?: boolean | undefined;
                    myOtherField?: boolean | undefined;
                  }
                | undefined
              )[]
            | undefined
          >
        >;

        // Touched fields map (nested booleans)
        type _t12 = Expect<
          Equal<typeof state.touchedFields.foo, boolean | undefined>
        >;
        const touchedBazQux = state.touchedFields.baz?.qux;
        type _t13 = Expect<Equal<typeof touchedBazQux, boolean | undefined>>;

        // defaultValues is DeepPartial<FormType> | undefined in RHF
        const defaultFoo = state.defaultValues?.foo;
        const defaultBazQux = state.defaultValues?.baz?.qux;
        type _t14 = Expect<Equal<typeof defaultFoo, string | undefined>>;
        type _t15 = Expect<Equal<typeof defaultBazQux, string | undefined>>;

        return null;
      },
    });
  }

  /** it should accept a single subscribed name and keep the return type */ {
    const { control } = useForm<FormType>();

    void FormStateSubscribe({
      control,
      name: 'baz.qux',
      render: (state) => {
        type _t1 = Expect<Equal<typeof state, UseFormStateReturn<FormType>>>;
        const errBazQuxMsg = state.errors.baz?.qux?.message;
        type _t2 = Expect<Equal<typeof errBazQuxMsg, string | undefined>>;
        const dirtyBazQux = state.dirtyFields.baz?.qux;
        type _t3 = Expect<Equal<typeof dirtyBazQux, boolean | undefined>>;
        const touchedBazQux = state.touchedFields.baz?.qux;
        type _t4 = Expect<Equal<typeof touchedBazQux, boolean | undefined>>;
        return null;
      },
    });
  }

  /** it should accept multiple subscribed names and keep the return type */ {
    const { control } = useForm<FormType>();

    void FormStateSubscribe({
      control,
      name: ['foo', 'bar', 'baz.qux'] as const,
      render: (state) => {
        type _t1 = Expect<Equal<typeof state, UseFormStateReturn<FormType>>>;
        const errFooMsg = state.errors.foo?.message;
        const errBarMsg = state.errors.bar?.message;
        const errBazQuxMsg = state.errors.baz?.qux?.message;
        type _t2 = Expect<Equal<typeof errFooMsg, string | undefined>>;
        type _t3 = Expect<Equal<typeof errBarMsg, string | undefined>>;
        type _t4 = Expect<Equal<typeof errBazQuxMsg, string | undefined>>;
        return null;
      },
    });
  }

  /** it should allow using context (no control prop) and still infer types when provided upstream */ {
    // This block is purely type-level: we just assert render param type remains UseFormStateReturn<any>
    // when control isn't passed directly. Actual inference comes from provider at runtime.
    void FormStateSubscribe({
      // no control
      render: (state) => {
        // Without a generic argument here, state defaults to FieldValues
        type _t = Expect<Equal<typeof state, UseFormStateReturn<FieldValues>>>;
        return null;
      },
    });
  }
}
