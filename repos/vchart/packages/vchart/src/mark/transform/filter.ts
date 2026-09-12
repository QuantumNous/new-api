import { Factory } from '../../core/factory';
import type { Datum } from '../../typings/common';

export const registerMarkFilterTransform = () => {
  Factory.registerGrammarTransform('filter', {
    transform: (
      options: {
        callback: (datum: Datum) => boolean;
      },
      data: Datum[]
    ) => {
      return data?.filter(options.callback);
    }
  });
};
