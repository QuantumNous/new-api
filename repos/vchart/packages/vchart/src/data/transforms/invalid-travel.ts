import type { Datum, IInvalidType, StringOrNumber } from '../../typings';
import { couldBeValidNumber } from '../../util/type';

export interface ITravelOpt {
  config: () => {
    invalidType: IInvalidType;
    checkField: StringOrNumber[];
  };
}

export const invalidTravel = (data: Array<any>, op: ITravelOpt) => {
  const { config } = op;
  if (!config) {
    return data;
  }
  const { invalidType, checkField } = config();
  if (invalidType !== 'zero') {
    return data;
  }

  if (checkField && checkField.length) {
    data.forEach((datum: Datum) => {
      checkField.forEach(field => {
        if (!couldBeValidNumber(datum[field])) {
          datum[field] = 0;
        }
      });
    });
  }
  return data;
};
