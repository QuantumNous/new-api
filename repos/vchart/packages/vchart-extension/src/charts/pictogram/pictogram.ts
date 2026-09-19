import { BaseChart, Factory, registerMarkTooltipProcessor } from '@visactor/vchart';
import type { IPictogramChartSpec } from './interface';
import { PictogramChartSpecTransformer } from './pictogram-transformer';
import { PICTOGRAM_CHART_TYPE, PICTOGRAM_SERIES_TYPE } from './series/constant';
import { registerPictogramSeries } from './series/pictogram';

export class PictogramChart<T extends IPictogramChartSpec = IPictogramChartSpec> extends BaseChart<T> {
  static readonly type: string = PICTOGRAM_SERIES_TYPE;
  static readonly seriesType: string = PICTOGRAM_CHART_TYPE;
  static readonly transformerConstructor = PictogramChartSpecTransformer;
  readonly transformerConstructor = PictogramChartSpecTransformer;
  readonly type: string = PICTOGRAM_CHART_TYPE;
  readonly seriesType: string = PICTOGRAM_SERIES_TYPE;
}

export const registerPictogramChart = () => {
  registerMarkTooltipProcessor();
  registerPictogramSeries();
  Factory.registerChart(PictogramChart.type, PictogramChart);
};
