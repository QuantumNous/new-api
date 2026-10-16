import type { ISeries } from '../../../../series/interface';
import type { StringOrNumber } from '../../../../typings';

export interface IDiscreteLegendData {
  key: string;
  /** 图例的原始 key，直接取 datum 里的原始值 */
  originalKey: any;
  style: (attribute: string) => any;
}

export interface IDiscreteLegendDataMakeOption {
  series: () => ISeries[];
  seriesField: (s: ISeries) => string;
}

export interface IDiscreteLegendFilterOption {
  series: ISeries;
  selected: () => StringOrNumber[];
  field: () => string;
  data: () => StringOrNumber[];
  customFilter?: (data: any, selectedRange: StringOrNumber[], datumField: string) => any;
}
