import type { IChartExtendsSeriesSpec, IChartSpec } from '@visactor/vchart';
import type { IPictogramSeriesSpec } from './series/interface';

export interface IPictogramChartSpec extends IChartSpec, IChartExtendsSeriesSpec<any> {
  type: 'pictogram';
  series?: IPictogramSeriesSpec[];
}
