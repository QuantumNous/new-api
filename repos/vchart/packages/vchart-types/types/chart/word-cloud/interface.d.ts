import type { IWordCloudSeriesSpec } from '../../series/word-cloud/interface';
import type { IChartExtendsSeriesSpec, IChartSpec } from '../../typings/spec/common';
export interface IWordCloudChartSpec extends IChartSpec, IChartExtendsSeriesSpec<IWordCloudSeriesSpec> {
    type: 'wordCloud';
    series?: IWordCloudSeriesSpec[];
}
