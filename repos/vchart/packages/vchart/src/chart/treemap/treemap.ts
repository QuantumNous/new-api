import { SeriesTypeEnum } from '../../series/interface/type';
import { BaseChart } from '../base/base-chart';
import { ChartTypeEnum } from '../interface/type';
import type { ITreemapChartSpec } from './interface';
import { registerTreemapSeries } from '../../series/treemap/treemap';
import { Factory } from '../../core/factory';
import type { AdaptiveSpec } from '../../typings';
import { TreemapChartSpecTransformer } from './treemap-transformer';
import { registerMarkTooltipProcessor } from '../../component/tooltip/processor/mark-tooltip';

export class TreemapChart<T extends ITreemapChartSpec = ITreemapChartSpec> extends BaseChart<
  AdaptiveSpec<T, 'data' | 'series'>
> {
  static readonly type: string = ChartTypeEnum.treemap;
  static readonly seriesType: string = SeriesTypeEnum.treemap;
  static readonly transformerConstructor = TreemapChartSpecTransformer;
  readonly transformerConstructor = TreemapChartSpecTransformer;
  readonly type: string = ChartTypeEnum.treemap;
  readonly seriesType: string = SeriesTypeEnum.treemap;
}

export const registerTreemapChart = () => {
  registerMarkTooltipProcessor();
  registerTreemapSeries();
  Factory.registerChart(TreemapChart.type, TreemapChart);
};
