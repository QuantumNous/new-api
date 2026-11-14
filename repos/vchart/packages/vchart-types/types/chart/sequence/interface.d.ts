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
    appendPadding?: IPadding;
    axes?: ICartesianAxisSpec[];
    dataZooms?: IDataZoomSpec[];
    scrollBars?: IScrollBarSpec[];
    crosshair?: ICartesianCrosshairSpec | ICartesianCrosshairSpec[];
    layout?: ILayoutSpec;
    region?: RegionSpec[];
}
export interface ISequenceSeriesSpec extends ISeriesSpec {
    height?: number;
    padding?: number;
    dataDot?: any;
    dotSeriesIndex?: number;
    dotSeriesSpec?: ISeriesSpec;
}
