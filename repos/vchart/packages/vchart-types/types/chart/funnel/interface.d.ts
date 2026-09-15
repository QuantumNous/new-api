import type { IChartExtendsSeriesSpec } from '../../typings';
import type { IFunnelSeriesSpec } from '../../series/funnel/interface';
import type { IChartSpec } from '../../typings/spec';
export interface IFunnelChartSpec extends IChartSpec, IChartExtendsSeriesSpec<IFunnelSeriesSpec> {
    type: 'funnel';
}
