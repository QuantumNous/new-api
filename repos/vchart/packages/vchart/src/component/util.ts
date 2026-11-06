import type { Maybe } from '@visactor/vutils';
import { isArray, isNil } from '@visactor/vutils';
import type { Datum } from '../typings';
import { Factory } from '../core/factory';
import type { IModelSpecInfo } from '../model/interface';

export function getComponentThemeFromOption(type: string, getTheme: (...keys: string[]) => any) {
  return getTheme('component', type);
}

export function getFormatFunction(
  formatMethod?: any,
  formatter?: string | string[],
  text?: string | number,
  datum?: Datum
) {
  if (formatMethod) {
    return { formatFunc: formatMethod, args: [text, datum] };
  }
  const formatterImpl = Factory.getFormatter();
  if (formatter && formatterImpl) {
    return { formatFunc: formatterImpl, args: [text, datum, formatter] };
  }
  return {};
}

export const getSpecInfo = <T extends Record<string, any>>(
  chartSpec: any,
  specKey: string,
  compType: string,
  filter?: (spec: T) => boolean
): Maybe<IModelSpecInfo<T>[]> => {
  if (isNil(chartSpec[specKey])) {
    return undefined;
  }
  const isArraySpec = isArray(chartSpec[specKey]);
  const spec = isArraySpec ? chartSpec[specKey] : [chartSpec[specKey]];

  const specInfos: IModelSpecInfo[] = [];
  (spec as T[]).forEach((s, i: number) => {
    if (s && (!filter || filter(s))) {
      specInfos.push({
        spec: s,
        specPath: isArraySpec ? [specKey, i] : [specKey],
        specInfoPath: ['component', specKey, i],
        type: compType
      });
    }
  });
  return specInfos;
};
