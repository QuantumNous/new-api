import type { IBarSeriesSpec } from '../../series/bar/interface';
import type { IChartExtendsSeriesSpec } from '../../typings/spec/common';
import type { ICartesianChartSpec } from '../cartesian/interface';
export interface IBarChartSpec extends ICartesianChartSpec, IChartExtendsSeriesSpec<IBarSeriesSpec> {
    type: 'bar';
    series?: IBarSeriesSpec[];
    autoBandSize?: boolean | {
        extend: number;
    };
}
