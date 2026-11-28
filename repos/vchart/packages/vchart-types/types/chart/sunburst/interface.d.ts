import type { ISunburstSeriesSpec } from '../../series/sunburst/interface';
import type { IChartExtendsSeriesSpec, IChartSpec } from '../../typings/spec/common';
export interface ISunburstChartSpec extends IChartSpec, IChartExtendsSeriesSpec<ISunburstSeriesSpec> {
    type: 'sunburst';
    series?: ISunburstSeriesSpec[];
}
