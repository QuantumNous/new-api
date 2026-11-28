import { SeriesTypeEnum } from '../../series/interface/type';
import { BaseChart } from '../base/base-chart';
import { ChartTypeEnum } from '../interface/type';
import type { ICirclePackingChartSpec } from './interface';
import { registerCirclePackingSeries } from '../../series/circle-packing/circle-packing';
import { Factory } from '../../core/factory';
import { CirclePackingChartSpecTransformer } from './circle-packing-transformer';
import { registerMarkTooltipProcessor } from '../../component/tooltip/processor/mark-tooltip';

export class CirclePackingChart<T extends ICirclePackingChartSpec = ICirclePackingChartSpec> extends BaseChart<T> {
  static readonly type: string = ChartTypeEnum.circlePacking;
  static readonly seriesType: string = SeriesTypeEnum.circlePacking;
  static readonly transformerConstructor = CirclePackingChartSpecTransformer;
  readonly transformerConstructor = CirclePackingChartSpecTransformer;
  readonly type: string = ChartTypeEnum.circlePacking;
  readonly seriesType: string = SeriesTypeEnum.circlePacking;
}

export const registerCirclePackingChart = () => {
  registerMarkTooltipProcessor();
  registerCirclePackingSeries();
  Factory.registerChart(CirclePackingChart.type, CirclePackingChart);
};
