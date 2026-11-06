import type { AdaptiveSpec } from '@visactor/vchart';
import { Factory, RangeColumnSeries, registerCartesianBandAxis, registerCartesianLinearAxis } from '@visactor/vchart';
import type { IRangeColumn3dSeriesSpec } from './interface';
import { rangeColumn3dSeriesMark } from './constant';
import { MarkType3dEnum, SeriesType3dEnum } from '../3d/enum';
import { registerRect3dMark } from '../3d/rect-3d';

export const DefaultBandWidth = 6; // 默认的bandWidth，避免连续轴没有bandWidth

export class RangeColumn3dSeries<
  T extends IRangeColumn3dSeriesSpec = IRangeColumn3dSeriesSpec
> extends RangeColumnSeries<AdaptiveSpec<T, 'type'>> {
  static readonly type: string = SeriesType3dEnum.rangeColumn3d;
  type = SeriesType3dEnum.rangeColumn3d;
  protected _barMarkType = MarkType3dEnum.rect3d;
  protected _barName: string = SeriesType3dEnum.bar3d;
  static readonly mark = rangeColumn3dSeriesMark;
}

export const registerRangeColumn3dSeries = () => {
  registerRect3dMark();
  registerCartesianBandAxis();
  registerCartesianLinearAxis();
  Factory.registerSeries(RangeColumn3dSeries.type, RangeColumn3dSeries);
};
