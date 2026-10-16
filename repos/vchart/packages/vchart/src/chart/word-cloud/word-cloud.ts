import { SeriesTypeEnum } from '../../series/interface/type';
import { ChartTypeEnum } from '../interface/type';
import type { IWordCloudChartSpec } from './interface';
import { BaseWordCloudChart } from './base/base';
import { registerWordCloudSeries, registerWordCloudShapeSeries } from '../../series/word-cloud/word-cloud';
import { Factory } from '../../core/factory';
import { BaseWordCloudChartSpecTransformer } from './base/word-cloud-base-transformer';
import { registerMarkTooltipProcessor } from '../../component/tooltip/processor/mark-tooltip';

export class WordCloudChart extends BaseWordCloudChart<IWordCloudChartSpec> {
  static readonly type: string = ChartTypeEnum.wordCloud;
  static readonly seriesType: string = SeriesTypeEnum.wordCloud;
  static readonly transformerConstructor = BaseWordCloudChartSpecTransformer;
  readonly transformerConstructor = BaseWordCloudChartSpecTransformer;
  readonly type: string = ChartTypeEnum.wordCloud;
  readonly seriesType: string = SeriesTypeEnum.wordCloud;
}

export const registerWordCloudChart = () => {
  registerMarkTooltipProcessor();
  registerWordCloudSeries();
  Factory.registerChart(WordCloudChart.type, WordCloudChart);
};

// Splitting the register logic into two parts is to tree-shake the unused transforms as much as possible.
// Especially in the cross-terminal environment,  word-cloud shape is not compatible.
export const registerWordCloudShapeChart = () => {
  registerWordCloudShapeSeries();
  registerWordCloudChart();
};
