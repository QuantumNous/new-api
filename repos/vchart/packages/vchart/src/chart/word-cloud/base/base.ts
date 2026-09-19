import { SeriesTypeEnum } from '../../../series/interface/type';
import { ChartTypeEnum } from '../../interface/type';
import { BaseChart } from '../../base/base-chart';
import type { IWordCloudChartSpec } from '../interface';
import { BaseWordCloudChartSpecTransformer } from './word-cloud-base-transformer';

export class BaseWordCloudChart<T extends IWordCloudChartSpec> extends BaseChart<T> {
  static readonly transformerConstructor = BaseWordCloudChartSpecTransformer;
  readonly transformerConstructor = BaseWordCloudChartSpecTransformer;
  readonly type: string = ChartTypeEnum.wordCloud;
  readonly seriesType: string = SeriesTypeEnum.wordCloud;
}
