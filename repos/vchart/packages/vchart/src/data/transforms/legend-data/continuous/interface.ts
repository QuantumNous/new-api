import type { IBaseScale } from '@visactor/vscale';
import type { ISeries } from '../../../../series/interface';
import type { StringOrNumber } from '../../../../typings';

export interface IContinuousLegendDataMakeOption {
  series: () => ISeries[];
  field: () => string | undefined;
  scale?: () => IBaseScale;
}

export interface IContinuousLegendFilterOption {
  selected: () => StringOrNumber[];
  field: () => string | undefined;
  data: () => StringOrNumber[];
  isHierarchyData?: () => boolean;
  customFilter?: (data: any, selectedRange: StringOrNumber[], datumField: string) => any;
}
