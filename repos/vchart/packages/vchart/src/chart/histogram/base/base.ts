import { mixin } from '@visactor/vutils';
import { BaseChart } from '../../base';
import { StackChartMixin } from '../../stack';
import type { IHistogramChartSpec } from '../interface';
import { BaseHistogramChartSpecTransformer } from './histogram-base-transformer';

export class BaseHistogramChart<T extends IHistogramChartSpec> extends BaseChart<T> {
  static readonly transformerConstructor = BaseHistogramChartSpecTransformer;
  readonly transformerConstructor = BaseHistogramChartSpecTransformer;
}

mixin(BaseHistogramChart, StackChartMixin);
