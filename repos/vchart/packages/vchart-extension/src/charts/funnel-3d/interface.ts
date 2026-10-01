import type {
  IChartExtendsSeriesSpec,
  IChartSpec,
  IFunnelSeriesSpec,
  IMarkTheme,
  IRuleMarkSpec,
  ITextMarkSpec,
  SeriesMarkNameEnum
} from '@visactor/vchart';
import type { IPyramid3dMarkSpec } from '../3d/interface';
import type { SeriesMark3dNameEnum } from '../3d/enum';

export interface IFunnel3dChartSpec extends IChartSpec, IChartExtendsSeriesSpec<IFunnel3dSeriesSpec> {
  type: 'funnel3d';
}

export type IFunnel3dSeriesSpec = {
  type: 'funnel3d';
} & Omit<IFunnelSeriesSpec, 'type'>;

export interface IFunnel3dSeriesTheme {
  [SeriesMark3dNameEnum.funnel3d]?: Partial<IMarkTheme<IPyramid3dMarkSpec>>;
  [SeriesMark3dNameEnum.transform3d]?: Partial<IMarkTheme<IPyramid3dMarkSpec>>;
  [SeriesMarkNameEnum.label]?: Partial<IMarkTheme<ITextMarkSpec>>;
  [SeriesMarkNameEnum.outerLabel]?: Partial<IMarkTheme<ITextMarkSpec>> & {
    line?: Partial<IMarkTheme<IRuleMarkSpec>>;
  };
  [SeriesMarkNameEnum.transformLabel]?: Partial<IMarkTheme<ITextMarkSpec>>;
}
