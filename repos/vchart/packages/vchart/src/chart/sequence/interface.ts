import type { IChartSpec, ISeriesSpec } from '../../typings/spec/common';
import type { ICartesianAxisSpec } from '../../component/axis/cartesian/interface';
import type { IDataZoomSpec } from '../../component/data-zoom/data-zoom/interface';
import type { IScrollBarSpec } from '../../component/data-zoom/scroll-bar/interface';
import type { ICartesianCrosshairSpec } from '../../component/crosshair/interface';
import type { ILayoutSpec } from '../../layout/interface';
import type { RegionSpec } from '../../region/interface';
import type { IPadding } from '../../typings';

export interface ISequenceChartSpec extends IChartSpec {
  type: 'sequence';

  /** 可以为左边的title预留padding */
  appendPadding?: IPadding;

  /** 轴配置 */
  axes?: ICartesianAxisSpec[];
  /** 缩略轴配置 */
  dataZooms?: IDataZoomSpec[];
  /** 滚动条配置 */
  scrollBars?: IScrollBarSpec[];
  /** 十字辅助线配置 */
  crosshair?: ICartesianCrosshairSpec | ICartesianCrosshairSpec[];

  layout?: ILayoutSpec;

  region?: RegionSpec[];
}

export interface ISequenceSeriesSpec extends ISeriesSpec {
  // 以下属性仅支持sequence chart中的series
  height?: number;
  padding?: number;

  // 以下属性仅支持sequence chart中的link series
  dataDot?: any;
  dotSeriesIndex?: number;
  dotSeriesSpec?: ISeriesSpec;
}
