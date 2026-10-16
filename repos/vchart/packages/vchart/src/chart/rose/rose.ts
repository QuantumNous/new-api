import { registerRoseSeries } from '../../series/rose/rose';
import { SeriesTypeEnum } from '../../series/interface/type';
import { ChartTypeEnum } from '../interface/type';
import { Factory } from '../../core/factory';
import type { IRoseChartSpec } from './interface';
import { RoseChartSpecTransformer } from './rose-transformer';
import { BaseChart } from '../base';
import { StackChartMixin } from '../stack';
import { mixin } from '@visactor/vutils';
import { registerDimensionHover } from '../../interaction/triggers/dimension-hover';
import { registerDimensionEvents } from '../../event/events';
import { getPolarDimensionInfo } from '../../event/events/dimension/util/polar';
import { registerDimensionTooltipProcessor } from '../../component/tooltip/processor/dimension-tooltip';
import { registerMarkTooltipProcessor } from '../../component/tooltip/processor/mark-tooltip';

export class RoseChart<T extends IRoseChartSpec = IRoseChartSpec> extends BaseChart<T> {
  static readonly type: string = ChartTypeEnum.rose;
  static readonly seriesType: string = SeriesTypeEnum.rose;
  static readonly transformerConstructor = RoseChartSpecTransformer;
  readonly transformerConstructor = RoseChartSpecTransformer;
  readonly type: string = ChartTypeEnum.rose;
  readonly seriesType: string = SeriesTypeEnum.rose;

  protected _setModelOption() {
    this._modelOption.getDimensionInfo = getPolarDimensionInfo;
  }
}

mixin(RoseChart, StackChartMixin);

export const registerRoseChart = () => {
  registerDimensionTooltipProcessor();
  registerMarkTooltipProcessor();
  registerDimensionEvents();
  registerDimensionHover();
  registerRoseSeries();
  Factory.registerChart(RoseChart.type, RoseChart);
};
