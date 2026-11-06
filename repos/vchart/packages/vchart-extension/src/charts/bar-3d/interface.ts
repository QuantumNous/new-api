import type {
  BarAppearPreset,
  IAnimationSpec,
  IBarSeriesSpec,
  ICartesianChartSpec,
  ICartesianSeriesSpec,
  ICartesianSeriesTheme,
  IChartExtendsSeriesSpec,
  IMarkTheme
} from '@visactor/vchart';
import type { SeriesMark3dNameEnum } from '../3d/enum';
import type { IRect3dMarkSpec } from '../3d/interface';

export interface IBar3dChartSpec extends ICartesianChartSpec, IChartExtendsSeriesSpec<IBar3dSeriesSpec> {
  type: 'bar3d';
  /** 系列配置 */
  series?: IBar3dSeriesSpec[];
}

export type IBar3dSeriesSpec = {
  type: 'bar3d';
} & Omit<IBarSeriesSpec, 'type'> &
  ICartesianSeriesSpec &
  IAnimationSpec<'bar', BarAppearPreset>;

export interface IBar3dSeriesTheme extends ICartesianSeriesTheme {
  [SeriesMark3dNameEnum.bar3d]?: Partial<IMarkTheme<IRect3dMarkSpec>>;
}
