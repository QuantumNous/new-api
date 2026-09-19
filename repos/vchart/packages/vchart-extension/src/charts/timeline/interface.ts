import type { IChartExtendsSeriesSpec, IChartSpec, ICartesianAxisSpec } from '@visactor/vchart';
import type { IEventSeriesSpec } from './series/interface';

export interface ITimelineChartSpec
  extends IChartSpec,
    Omit<IChartExtendsSeriesSpec<IEventSeriesSpec>, 'type' | 'title'> {
  type: 'timeline';
  series?: IEventSeriesSpec[];
  axes?: ICartesianAxisSpec[];
}
