import { registerBarSeries } from '../../series/bar/bar';
import { SeriesTypeEnum } from '../../series/interface/type';
import { ChartTypeEnum } from '../interface/type';
import type { IBarChartSpec } from './interface';
import { Factory } from '../../core/factory';
import { BarChartSpecTransformer } from './bar-transformer';
import { BaseChart } from '../base';
import { mixin } from '@visactor/vutils';
import { StackChartMixin } from '../stack';
import { registerDimensionHover } from '../../interaction/triggers/dimension-hover';
import { registerDimensionEvents } from '../../event/events';
import { getCartesianDimensionInfo, getDimensionInfoByValue } from '../../event/events/dimension/util/cartesian';
import { getCartesianCrosshairRect } from '../../component/crosshair/utils/cartesian';
import { registerDimensionTooltipProcessor } from '../../component/tooltip/processor/dimension-tooltip';
import { registerMarkTooltipProcessor } from '../../component/tooltip/processor/mark-tooltip';
import { registerGroupTooltipProcessor } from '../../component/tooltip/processor/group-tooltip';

export class BarChart<T extends IBarChartSpec = IBarChartSpec> extends BaseChart<T> {
  static readonly type: string = ChartTypeEnum.bar;
  static readonly seriesType: string = SeriesTypeEnum.bar;
  static readonly transformerConstructor = BarChartSpecTransformer;
  readonly transformerConstructor = BarChartSpecTransformer;
  readonly type: string = ChartTypeEnum.bar;
  readonly seriesType: string = SeriesTypeEnum.bar;

  protected _setModelOption() {
    this._modelOption.getDimensionInfo = getCartesianDimensionInfo;
    this._modelOption.getDimensionInfoByValue = getDimensionInfoByValue;
    this._modelOption.getRectByDimensionData = getCartesianCrosshairRect;
  }
}

mixin(BarChart, StackChartMixin);

export const registerBarChart = () => {
  registerDimensionTooltipProcessor();
  registerMarkTooltipProcessor();
  registerGroupTooltipProcessor();
  registerDimensionHover();
  registerBarSeries();
  registerDimensionEvents();
  Factory.registerChart(BarChart.type, BarChart);
};
