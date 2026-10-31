import { TimelineChartSpecTransformer } from './timeline-transformer';
import type { ITimelineChartSpec } from './interface';
import { registerEventSeries } from './series/event-series';
import { BaseChart, Factory, registerMarkTooltipProcessor } from '@visactor/vchart';

export class TimelineChart<T extends ITimelineChartSpec = ITimelineChartSpec> extends BaseChart<T> {
  static readonly type: string = 'timeline';
  static readonly seriesType: string = 'event';
  static readonly transformerConstructor = TimelineChartSpecTransformer;
  readonly transformerConstructor = TimelineChartSpecTransformer;
  readonly type: string = 'timeline';
  readonly seriesType: string = 'event';
}

export const registerTimelineChart = () => {
  registerMarkTooltipProcessor();
  registerEventSeries();
  Factory.registerChart(TimelineChart.type, TimelineChart);
};
