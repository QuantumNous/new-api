import type { IChartExtendsSeriesSpec } from '../../typings/spec/common';
import type { IRadarSeriesSpec } from '../../series/radar/interface';
import type { IPolarChartSpec } from '../polar/interface';
export interface IRadarChartSpec extends IPolarChartSpec, IChartExtendsSeriesSpec<IRadarSeriesSpec> {
    type: 'radar';
    series?: IRadarSeriesSpec[];
}
