import { registerGaugePointerSeries, registerGaugeSeries } from '../../series/gauge';
import { registerCircularProgressSeries } from '../../series/progress/circular/circular';
import { SeriesTypeEnum } from '../../series/interface/type';
import { ChartTypeEnum } from '../interface/type';
import { Factory } from '../../core/factory';
import type { IGaugeChartSpec } from './interface';
import { GaugeChartSpecTransformer } from './gauge-transformer';
import type { AdaptiveSpec } from '../../typings';
import { BaseChart } from '../base';
import { registerMarkTooltipProcessor } from '../../component/tooltip/processor/mark-tooltip';

export class GaugeChart<T extends IGaugeChartSpec = IGaugeChartSpec> extends BaseChart<AdaptiveSpec<T, 'axes'>> {
  static readonly type: string = ChartTypeEnum.gauge;
  static readonly seriesType: string = SeriesTypeEnum.gaugePointer;
  static readonly transformerConstructor = GaugeChartSpecTransformer;
  readonly transformerConstructor = GaugeChartSpecTransformer;
  readonly type: string = ChartTypeEnum.gauge;
  readonly seriesType: string = SeriesTypeEnum.gaugePointer;
}

export const registerGaugeChart = () => {
  registerMarkTooltipProcessor();
  registerGaugePointerSeries();
  registerGaugeSeries();
  // Gauge chart reused the code logic of CircularProgressSeries, So it needs to be registered by default.
  registerCircularProgressSeries();
  Factory.registerChart(GaugeChart.type, GaugeChart);
};
