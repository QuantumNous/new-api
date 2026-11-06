import { registerFunnelSeries } from './../../series/funnel/funnel';
import { SeriesTypeEnum } from '../../series/interface/type';
import { ChartTypeEnum } from '../interface/type';
import { Factory } from '../../core/factory';
import type { IFunnelChartSpec } from './interface';
import { FunnelChartSpecTransformer } from './funnel-transformer';
import { BaseChart } from '../base';
import { registerMarkTooltipProcessor } from '../../component/tooltip/processor/mark-tooltip';

export class FunnelChart<T extends IFunnelChartSpec = IFunnelChartSpec> extends BaseChart<T> {
  static readonly type: string = ChartTypeEnum.funnel;
  static readonly seriesType: string = SeriesTypeEnum.funnel;
  static readonly transformerConstructor = FunnelChartSpecTransformer;
  readonly transformerConstructor = FunnelChartSpecTransformer;
  readonly type: string = ChartTypeEnum.funnel;
  readonly seriesType: string = SeriesTypeEnum.funnel;
}

export const registerFunnelChart = () => {
  registerMarkTooltipProcessor();
  registerFunnelSeries();
  Factory.registerChart(FunnelChart.type, FunnelChart);
};
