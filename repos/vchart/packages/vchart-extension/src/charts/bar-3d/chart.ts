import type { AdaptiveSpec } from '@visactor/vchart';
import { BarChart, Factory } from '@visactor/vchart';
import { Bar3dChartSpecTransformer } from './chart-spec-transformer';
import type { IBar3dChartSpec } from './interface';
import { ChartType3dEnum, SeriesType3dEnum } from '../3d/enum';
import { register3DPlugin } from '../3d/plugin';
import { registerBar3dSeries } from './series';
import { registerLayout3d } from '../3d/layout';

export class Bar3dChart<T extends IBar3dChartSpec = IBar3dChartSpec> extends BarChart<
  AdaptiveSpec<T, 'type' | 'series'>
> {
  static readonly type: string = ChartType3dEnum.bar3d;
  static readonly seriesType: string = SeriesType3dEnum.bar3d;
  static readonly transformerConstructor = Bar3dChartSpecTransformer;
  // @ts-ignore
  readonly transformerConstructor = Bar3dChartSpecTransformer;
  readonly type: string = ChartType3dEnum.bar3d;
  readonly seriesType: string = SeriesType3dEnum.bar3d;
}

export const registerBar3dChart = () => {
  register3DPlugin();
  registerLayout3d();
  registerBar3dSeries();
  Factory.registerChart(Bar3dChart.type, Bar3dChart);
};
