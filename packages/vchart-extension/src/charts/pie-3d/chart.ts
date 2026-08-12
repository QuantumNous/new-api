import { Factory } from '@visactor/vchart/esm/core/factory';
import type { AdaptiveSpec } from '@visactor/vchart/esm/typings/spec/common';
import { BasePieChart } from '@visactor/vchart/esm/chart/pie/base/base';
import { registerMarkTooltipProcessor } from '@visactor/vchart/esm/component/tooltip/processor/mark-tooltip';
import type { IPie3dChartSpec } from './interface';
import { ChartType3dEnum, SeriesType3dEnum } from '../3d/enum';
import { register3DPlugin } from '../3d/plugin';
import { registerPie3dSeries } from './series';
import { registerLayout3d } from '../3d/layout';
import { Pie3dChartSpecTransformer } from './chart-spec-transformer';

export class Pie3dChart<T extends IPie3dChartSpec = IPie3dChartSpec> extends BasePieChart<AdaptiveSpec<T, 'type'>> {
  static readonly type: string = ChartType3dEnum.pie3d;
  static readonly seriesType: string = SeriesType3dEnum.pie3d;
  static readonly transformerConstructor = Pie3dChartSpecTransformer;
  // @ts-ignore
  readonly transformerConstructor = Pie3dChartSpecTransformer;
  readonly type: string = ChartType3dEnum.pie3d;
  readonly seriesType: string = SeriesType3dEnum.pie3d;
}

export const registerPie3dChart = () => {
  registerMarkTooltipProcessor();
  register3DPlugin();
  registerLayout3d();
  registerPie3dSeries();
  Factory.registerChart(Pie3dChart.type, Pie3dChart);
};
