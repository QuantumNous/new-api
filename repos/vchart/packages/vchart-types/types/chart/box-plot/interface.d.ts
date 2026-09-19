import type { IBoxPlotSeriesSpec } from '../../series/box-plot/interface';
import type { ICartesianChartSpec } from '../cartesian/interface';
import type { IChartExtendsSeriesSpec } from '../../typings/spec/common';
export interface IBoxPlotChartSpec extends ICartesianChartSpec, IChartExtendsSeriesSpec<IBoxPlotSeriesSpec> {
    type: 'boxPlot';
    series?: IBoxPlotSeriesSpec[];
}
