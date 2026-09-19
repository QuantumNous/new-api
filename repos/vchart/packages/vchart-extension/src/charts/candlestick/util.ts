import type { ICartesianSeriesSpec } from '@visactor/vchart';
import type { ICandlestickSeriesSpec } from './series/interface';
export function transformCandlestickSeriesSpec(spec: ICandlestickSeriesSpec) {
  (spec as ICartesianSeriesSpec).yField = [spec.openField, spec.highField, spec.lowField, spec.closeField];
}
