import type { IChartExtendsSeriesSpec, ICartesianChartSpec } from '@visactor/vchart';
import type { ICandlestickSeriesSpec } from './series/interface';

export interface ICandlestickChartSpec extends ICartesianChartSpec, IChartExtendsSeriesSpec<ICandlestickSeriesSpec> {
  type: 'candlestick';
  /** 系列配置 */
  series?: ICandlestickSeriesSpec[];
}
