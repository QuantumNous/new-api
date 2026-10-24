import type { IFunnelSeriesSpec } from '../../series/funnel/interface';
import type { IFunnelChartSpec } from './interface';
import { BaseChart } from '../base-chart';
export declare class BaseFunnelChart extends BaseChart {
    seriesType: string;
    protected needAxes(): boolean;
    protected _getDefaultSeriesSpec(spec: IFunnelChartSpec): IFunnelSeriesSpec;
    transformSpec(spec: IFunnelChartSpec): void;
}
