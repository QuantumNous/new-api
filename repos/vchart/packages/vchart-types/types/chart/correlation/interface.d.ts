import type { ICorrelationSeriesSpec } from '../../series/correlation/interface';
import type { IChartExtendsSeriesSpec, IChartSpec } from '../../typings/spec/common';
export interface ICorrelationChartSpec extends Omit<IChartSpec, 'padding'>, IChartExtendsSeriesSpec<ICorrelationSeriesSpec> {
    type: 'correlation';
    series?: ICorrelationSeriesSpec[];
}
