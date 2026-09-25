import type { ICandlestickSeriesSpec } from './../candlestick/series/interface';
import type {
  ISeriesSpec,
  IAreaSeriesSpec,
  IBarSeriesSpec,
  ILineSeriesSpec,
  IRegionSpec,
  ICartesianLinearAxisSpec,
  ICartesianChartSpec
} from '@visactor/vchart';

export type ICombinationCandlestickPreviewSeriesSpec = IBarSeriesSpec | IAreaSeriesSpec | ILineSeriesSpec;

/**
 * @description 组合蜡烛图规约
 */
export interface ICombinationCandlestickChartSpec extends Omit<ICartesianChartSpec, 'region'> {
  type: 'combinationCandlestick';

  /** 与蜡烛图使用同region的系列配置 */
  series?: (ICombinationCandlestickPreviewSeriesSpec | ICandlestickSeriesSpec)[];

  // 蜡烛系列 必须配置数据 不可以为数组
  candlestickSeries: ICandlestickSeriesSpec;
  candlestickRegion?: IRegionSpec;

  // 预览系列 必须配置数据 不可以为数组
  previewSeries?: ICombinationCandlestickPreviewSeriesSpec | ICombinationCandlestickPreviewSeriesSpec[];
  previewRegion?: IRegionSpec;
  // 预览图高度  可以是数字，返回数字的函数，或者百分百字符串 '30%'
  previewHeight?: number | ((maxSize: number) => number) | string;

  /** 预览系列的数值轴， y轴 */
  previewAxes?: ICartesianLinearAxisSpec;
}
