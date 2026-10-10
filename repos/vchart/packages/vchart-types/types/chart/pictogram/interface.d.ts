import type { IPictogramSeriesSpec } from '../../series/pictogram/interface';
import type { IChartExtendsSeriesSpec, IChartSpec } from '../../typings/spec/common';
export interface IPictogramChartSpec extends IChartSpec, IChartExtendsSeriesSpec<any> {
    type: 'pictogram';
    series?: IPictogramSeriesSpec[];
}
