import { Factory } from '../../core/factory';
import type { Datum } from '../../typings/common';

export const registerMarkMapTransform = () => {
  Factory.registerGrammarTransform('map', {
    transform: (
      options: {
        as?: string;
        all?: boolean;
        callback: (datum: Datum) => boolean;
      },
      data: Datum[]
    ) => {
      data?.forEach((datum, index) => {
        options.callback(datum);
      });

      return data;
    }
  });
};
