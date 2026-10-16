import type { AdaptiveSpec } from '@visactor/vchart';
import { BaseChart, Factory, FunnelChartSpecTransformer, registerMarkTooltipProcessor } from '@visactor/vchart';
import { ChartType3dEnum, SeriesType3dEnum } from '../3d/enum';
import { register3DPlugin } from '../3d/plugin';
import type { IFunnel3dChartSpec } from './interface';
import { registerFunnel3dSeries } from './series';
import { registerLayout3d } from '../3d/layout';

export class Funnel3dChart<T extends IFunnel3dChartSpec = IFunnel3dChartSpec> extends BaseChart<
  AdaptiveSpec<T, 'type'>
> {
  static readonly type: string = ChartType3dEnum.funnel3d;
  static readonly seriesType: string = SeriesType3dEnum.funnel3d;
  static readonly transformerConstructor = FunnelChartSpecTransformer;
  readonly transformerConstructor = FunnelChartSpecTransformer;
  readonly type: string = ChartType3dEnum.funnel3d;
  readonly seriesType: string = SeriesType3dEnum.funnel3d;
}

export const registerFunnel3dChart = () => {
  registerMarkTooltipProcessor();
  register3DPlugin();
  registerLayout3d();
  registerFunnel3dSeries();
  Factory.registerChart(Funnel3dChart.type, Funnel3dChart);
};
