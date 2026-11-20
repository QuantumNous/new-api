import { SeriesTypeEnum } from '../../../series/interface/type';
import { ChartTypeEnum } from '../../interface';
import { registerCircularProgressSeries } from '../../../series/progress/circular';
import { Factory } from '../../../core/factory';
import type { ICircularProgressChartSpec } from './interface';
import { CircularProgressChartSpecTransformer } from './circular-progress-transformer';
import type { AdaptiveSpec } from '../../../typings';
import { BaseChart } from '../../base';
import { StackChartMixin } from '../../stack';
import { mixin } from '@visactor/vutils';
import { registerDimensionHover } from '../../../interaction/triggers/dimension-hover';
import { registerDimensionEvents } from '../../../event/events';
import { getPolarDimensionInfo } from '../../../event/events/dimension/util/polar';
import { registerDimensionTooltipProcessor } from '../../../component/tooltip/processor/dimension-tooltip';
import { registerMarkTooltipProcessor } from '../../../component/tooltip/processor/mark-tooltip';

export class CircularProgressChart<T extends ICircularProgressChartSpec = ICircularProgressChartSpec> extends BaseChart<
  AdaptiveSpec<T, 'axes'>
> {
  static readonly type: string = ChartTypeEnum.circularProgress;
  static readonly seriesType: string = SeriesTypeEnum.circularProgress;
  static readonly transformerConstructor = CircularProgressChartSpecTransformer;
  readonly transformerConstructor = CircularProgressChartSpecTransformer;
  readonly type: string = ChartTypeEnum.circularProgress;
  readonly seriesType: string = SeriesTypeEnum.circularProgress;

  protected _setModelOption() {
    this._modelOption.getDimensionInfo = getPolarDimensionInfo;
  }
}

mixin(CircularProgressChart, StackChartMixin);

export const registerCircularProgressChart = () => {
  registerDimensionTooltipProcessor();
  registerMarkTooltipProcessor();
  registerDimensionEvents();
  registerDimensionHover();
  registerCircularProgressSeries();
  Factory.registerChart(CircularProgressChart.type, CircularProgressChart);
};
