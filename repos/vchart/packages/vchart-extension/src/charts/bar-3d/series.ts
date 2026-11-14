import type { AdaptiveSpec, SeriesMarkMap } from '@visactor/vchart';
import { BarSeries, Factory, registerCartesianBandAxis, registerCartesianLinearAxis } from '@visactor/vchart';
import type { IBar3dSeriesSpec } from './interface';
import { MarkType3dEnum, SeriesMark3dNameEnum, SeriesType3dEnum } from '../3d/enum';
import { bar3dSeriesMark } from './constant';
import { Bar3dSeriesSpecTransformer } from './series-spec-transformer';
import { registerBar3dAnimation } from './animation';
import { registerRect3dMark } from '../3d/rect-3d';
import { bar3d } from './theme';

export class Bar3dSeries<T extends IBar3dSeriesSpec = IBar3dSeriesSpec> extends BarSeries<AdaptiveSpec<T, 'type'>> {
  static readonly type: string = SeriesType3dEnum.bar3d;
  type = SeriesType3dEnum.bar3d;

  static readonly mark: SeriesMarkMap = bar3dSeriesMark;
  static readonly builtInTheme = { bar3d };

  protected _barMarkName: SeriesMark3dNameEnum = SeriesMark3dNameEnum.bar3d;
  protected _barMarkType: MarkType3dEnum = MarkType3dEnum.rect3d;

  static readonly transformerConstructor = Bar3dSeriesSpecTransformer as any;
  readonly transformerConstructor = Bar3dSeriesSpecTransformer as any;
}

export const registerBar3dSeries = () => {
  registerBar3dAnimation();
  registerRect3dMark();
  registerCartesianBandAxis();
  registerCartesianLinearAxis();
  Factory.registerSeries(Bar3dSeries.type, Bar3dSeries);
};
