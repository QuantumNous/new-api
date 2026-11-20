import { useFormContext } from '../useFormContext';

import type { Equal, Expect } from './__fixtures__';

/** it should correctly infer the output type from useFormContext */ {
  type Input = {
    test: string;
  };

  /* eslint-disable react-hooks/rules-of-hooks */
  const { handleSubmit } = useFormContext<Input>();

  handleSubmit((data) => {
    type _t = Expect<Equal<typeof data, Input>>;
  });
}

/** it should correctly infer the output type from useFormContext with different output type */ {
  type Input = {
    test: string;
  };

  type Output = {
    test: number;
  };

  /* eslint-disable react-hooks/rules-of-hooks */
  const { handleSubmit } = useFormContext<Input, any, Output>();

  handleSubmit((data) => {
    type _t = Expect<Equal<typeof data, Output>>;
  });
}
