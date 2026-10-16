import type { IChart, ILayoutPoint } from '@visactor/vchart';
import {
  BaseChart,
  Factory,
  StackChartMixin,
  getCartesianCrosshairRect,
  getCartesianDimensionInfo,
  getDimensionInfoByValue
} from '@visactor/vchart';
import type { ICombinationCandlestickChartSpec } from './interface';
import { CombinationCandlestickChart_TYPE } from './constant';
import { registerCandlestickSeries } from '../candlestick';
import { CombinationCandlestickChartSpecTransformer } from './combination-candlestick-transformer';
import { mixin } from '@visactor/vchart';

/**
 * @description 组合蜡烛图
 */
export class CombinationCandlestickChart extends BaseChart<ICombinationCandlestickChartSpec> {
  static readonly type: string = CombinationCandlestickChart_TYPE;
  readonly type: string = CombinationCandlestickChart_TYPE;

  declare _spec: ICombinationCandlestickChartSpec;

  static readonly transformerConstructor = CombinationCandlestickChartSpecTransformer;
  readonly transformerConstructor = CombinationCandlestickChartSpecTransformer;

  protected _setModelOption() {
    this._modelOption.getDimensionInfo = (chart: IChart | undefined, point: ILayoutPoint, isTooltip?: boolean) => {
      return [...(getCartesianDimensionInfo(chart, point, isTooltip) ?? [])];
    };
    this._modelOption.getDimensionInfoByValue = getDimensionInfoByValue;
    this._modelOption.getRectByDimensionData = getCartesianCrosshairRect;
  }
}

mixin(CombinationCandlestickChart, StackChartMixin);

/**
 * @description 注册组合蜡烛图
 */
export const registerCombinationCandlestickChart = () => {
  registerCandlestickSeries();
  Factory.registerChart(CombinationCandlestickChart.type, CombinationCandlestickChart);
};
