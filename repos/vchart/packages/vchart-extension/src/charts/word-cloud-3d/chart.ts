import type { AdaptiveSpec } from '@visactor/vchart';
import { BaseWordCloudChart, Factory } from '@visactor/vchart';
import { register3DPlugin } from '../3d/plugin';
import type { IWordCloud3dChartSpec } from './interface';
import { registerWordCloud3dSeries, registerWordCloudShape3dSeries } from './series';
import { WordCloud3dChartSpecTransformer } from './chart-spec-transformer';
import { ChartType3dEnum, SeriesType3dEnum } from '../3d/enum';

export class WordCloud3dChart<T extends IWordCloud3dChartSpec = IWordCloud3dChartSpec> extends BaseWordCloudChart<
  AdaptiveSpec<T, 'type' | 'series'>
> {
  static readonly type: string = ChartType3dEnum.wordCloud3d;
  static readonly seriesType: string = SeriesType3dEnum.wordCloud3d;
  static readonly transformerConstructor = WordCloud3dChartSpecTransformer;
  // @ts-ignore
  readonly transformerConstructor = WordCloud3dChartSpecTransformer;
  readonly type: string = ChartType3dEnum.wordCloud3d;
  readonly seriesType: string = SeriesType3dEnum.wordCloud3d;
}

export const registerWordCloud3dChart = () => {
  register3DPlugin();
  registerWordCloud3dSeries();
  Factory.registerChart(WordCloud3dChart.type, WordCloud3dChart);
};

export const registerWordCloudShape3dChart = () => {
  register3DPlugin();
  registerWordCloudShape3dSeries();
  registerWordCloud3dChart();
};
