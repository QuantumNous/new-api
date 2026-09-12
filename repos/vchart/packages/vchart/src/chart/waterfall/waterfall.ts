import { SeriesTypeEnum } from '../../series/interface/type';
import { BarChart } from '../bar';
import { ChartTypeEnum } from '../interface/type';
import type { IWaterfallChartSpec } from './interface';
import { registerWaterfallSeries } from '../../series/waterfall/waterfall';
import { Factory } from '../../core/factory';
import type { AdaptiveSpec } from '../../typings';
import { WaterfallChartSpecTransformer } from './waterfall-transformer';
import { registerDimensionHover } from '../../interaction/triggers/dimension-hover';
import { registerDimensionEvents } from '../../event/events';
import { getCartesianDimensionInfo, getDimensionInfoByValue } from '../../event/events/dimension/util/cartesian';
import { getCartesianCrosshairRect } from '../../component/crosshair/utils/cartesian';
import { registerDimensionTooltipProcessor } from '../../component/tooltip/processor/dimension-tooltip';
import { registerMarkTooltipProcessor } from '../../component/tooltip/processor/mark-tooltip';
import { registerGroupTooltipProcessor } from '../../component/tooltip/processor/group-tooltip';

export class WaterfallChart<T extends IWaterfallChartSpec = IWaterfallChartSpec> extends BarChart<
  AdaptiveSpec<T, 'type' | 'series' | 'label'>
> {
  static readonly type: string = ChartTypeEnum.waterfall;
  static readonly seriesType: string = SeriesTypeEnum.waterfall;
  static readonly transformerConstructor = WaterfallChartSpecTransformer;
  // @ts-ignore
  readonly transformerConstructor = WaterfallChartSpecTransformer;
  readonly type: string = ChartTypeEnum.waterfall;
  readonly seriesType: string = SeriesTypeEnum.waterfall;

  protected _setModelOption() {
    this._modelOption.getDimensionInfo = getCartesianDimensionInfo;

    this._modelOption.getDimensionInfoByValue = getDimensionInfoByValue;

    this._modelOption.getRectByDimensionData = getCartesianCrosshairRect;
  }
}

export const registerWaterfallChart = () => {
  registerDimensionTooltipProcessor();
  registerMarkTooltipProcessor();
  registerGroupTooltipProcessor();
  registerDimensionEvents();
  registerDimensionHover();
  registerWaterfallSeries();
  Factory.registerChart(WaterfallChart.type, WaterfallChart);
};
