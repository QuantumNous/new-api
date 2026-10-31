import { registerScatterSeries } from '../../series/scatter/scatter';
import { SeriesTypeEnum } from '../../series/interface/type';
import { ChartTypeEnum } from '../interface/type';
import type { IScatterChartSpec } from './interface';
import { Factory } from '../../core/factory';
import { ScatterChartSpecTransformer } from './scatter-transformer';
import { BaseChart } from '../base';
import { StackChartMixin } from '../stack';
import { mixin } from '@visactor/vutils';
import { registerDimensionHover } from '../../interaction/triggers/dimension-hover';
import { registerDimensionEvents } from '../../event/events';
import { getCartesianDimensionInfo, getDimensionInfoByValue } from '../../event/events/dimension/util/cartesian';
import { getCartesianCrosshairRect } from '../../component/crosshair/utils/cartesian';
import { registerDimensionTooltipProcessor } from '../../component/tooltip/processor/dimension-tooltip';
import { registerMarkTooltipProcessor } from '../../component/tooltip/processor/mark-tooltip';

export class ScatterChart<T extends IScatterChartSpec = IScatterChartSpec> extends BaseChart<T> {
  static readonly type: string = ChartTypeEnum.scatter;
  static readonly seriesType: string = SeriesTypeEnum.scatter;
  static readonly transformerConstructor = ScatterChartSpecTransformer;
  // @ts-ignore
  readonly transformerConstructor = ScatterChartSpecTransformer;
  readonly type: string = ChartTypeEnum.scatter;
  readonly seriesType: string = SeriesTypeEnum.scatter;

  protected _setModelOption() {
    this._modelOption.getDimensionInfo = getCartesianDimensionInfo;

    this._modelOption.getDimensionInfoByValue = getDimensionInfoByValue;

    this._modelOption.getRectByDimensionData = getCartesianCrosshairRect;
  }
}

mixin(ScatterChart, StackChartMixin);

export const registerScatterChart = () => {
  registerDimensionTooltipProcessor();
  registerMarkTooltipProcessor();
  registerDimensionEvents();
  registerDimensionHover();
  registerScatterSeries();
  Factory.registerChart(ScatterChart.type, ScatterChart);
};
