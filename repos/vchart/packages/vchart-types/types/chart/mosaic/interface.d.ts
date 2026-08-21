import type { IChartExtendsSeriesSpec } from '../../typings/spec/common';
import type { ICartesianChartSpec } from '../cartesian/interface';
import type { IMosaicSeriesSpec } from '../../series/mosaic/interface';
export interface IMosaicChartSpec extends ICartesianChartSpec, IChartExtendsSeriesSpec<IMosaicSeriesSpec> {
    type: 'mosaic';
    series?: IMosaicSeriesSpec[];
}
