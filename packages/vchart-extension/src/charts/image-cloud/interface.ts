import type { IChartExtendsSeriesSpec, IChartSpec } from '@visactor/vchart';
import type { IImageCloudSeriesSpec } from './series/interface';

export interface IImageCloudChartSpec extends IChartSpec, Omit<IChartExtendsSeriesSpec<IImageCloudSeriesSpec>, 'type'> {
  type: 'imageCloud';
  series?: IImageCloudSeriesSpec[];
}
