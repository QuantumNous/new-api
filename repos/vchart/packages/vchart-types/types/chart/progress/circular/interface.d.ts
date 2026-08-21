import type { IChartExtendsSeriesSpec } from '../../../typings';
import type { ICircularProgressSeriesSpec } from '../../../series/progress/circular/interface';
import type { IProgressChartSpec } from '../interface';
export interface ICircularProgressChartSpec extends IProgressChartSpec, IChartExtendsSeriesSpec<ICircularProgressSeriesSpec> {
    type: 'circularProgress';
    series?: ICircularProgressSeriesSpec[];
}
