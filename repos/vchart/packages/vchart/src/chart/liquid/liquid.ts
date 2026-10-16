import { SeriesTypeEnum } from '../../series/interface/type';
import { ChartTypeEnum } from '../interface/type';
import type { ILiquidChartSpec } from './interface';
import { Factory } from '../../core/factory';
import { BaseChart } from '../base';
import { LiquidChartSpecTransformer } from './liquid-transformer';
import { registerLiquidSeries } from '../../series/liquid/liquid';
import { registerMarkTooltipProcessor } from '../../component/tooltip/processor/mark-tooltip';

export class LiquidChart<T extends ILiquidChartSpec = ILiquidChartSpec> extends BaseChart<T> {
  static readonly type: string = ChartTypeEnum.liquid;
  static readonly seriesType: string = SeriesTypeEnum.liquid;
  static readonly transformerConstructor = LiquidChartSpecTransformer;
  readonly transformerConstructor = LiquidChartSpecTransformer;
  readonly type: string = ChartTypeEnum.liquid;
  readonly seriesType: string = SeriesTypeEnum.liquid;
}

export const registerLiquidChart = () => {
  registerMarkTooltipProcessor();
  registerLiquidSeries();
  Factory.registerChart(LiquidChart.type, LiquidChart);
};
