import { array, isFunction } from '@visactor/vutils';
import type { IIndicatorItemSpec } from './interface';

export interface IIndicatorDatum {
  type: 'title' | 'content';
  index: number;
  datum: unknown;
  spec: IIndicatorItemSpec;
}

export interface IIndicatorMapper {
  title: IIndicatorItemSpec;
  content: IIndicatorItemSpec[];
  datum: () => unknown;
}

export type IndicatorMapperOption = IIndicatorMapper | (() => IIndicatorMapper);

export const indicatorMapper = (data: Array<unknown>, op: IndicatorMapperOption) => {
  const { datum, title, content } = isFunction(op) ? op() : op;
  const mappedData: IIndicatorDatum[] = [];
  const datumResult = datum.call(null);
  if (title.visible) {
    mappedData.push({
      type: 'title',
      index: 0,
      datum: datumResult,
      spec: title
    } as IIndicatorDatum);
  }
  array(content).forEach((c, i) => {
    if (c.visible) {
      mappedData.push({
        type: 'content',
        index: i,
        datum: datumResult,
        spec: c
      } as IIndicatorDatum);
    }
  });
  return mappedData;
};
