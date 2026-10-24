import type { IChartExtendsSeriesSpec } from '../../typings/spec/common';
import type { IRoseSeriesSpec } from '../../series/rose/interface';
import type { IPolarChartSpec } from '../polar/interface';
export interface IRoseChartSpec extends IPolarChartSpec, IChartExtendsSeriesSpec<IRoseSeriesSpec> {
    type: 'rose';
    series?: IRoseSeriesSpec[];
}
