import type { IVennSeriesSpec } from '../../series/venn/interface';
import type { IChartExtendsSeriesSpec, IChartSpec } from '../../typings/spec/common';
export interface IVennChartSpec extends IChartSpec, IChartExtendsSeriesSpec<IVennSeriesSpec> {
    type: 'venn';
    series?: IVennSeriesSpec[];
}
