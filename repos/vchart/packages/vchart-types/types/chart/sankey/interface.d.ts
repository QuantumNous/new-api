import type { ISankeySeriesSpec } from '../../series/sankey/interface';
import type { IChartExtendsSeriesSpec, IChartSpec } from '../../typings/spec/common';
export interface ISankeyChartSpec extends Omit<IChartSpec, 'padding'>, IChartExtendsSeriesSpec<ISankeySeriesSpec> {
    type: 'sankey';
    series?: ISankeySeriesSpec[];
}
