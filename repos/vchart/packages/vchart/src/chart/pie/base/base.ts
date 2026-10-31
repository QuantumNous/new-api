import type { AdaptiveSpec } from '../../../typings';
import { BaseChart } from '../../base';
import type { IPieChartSpec } from '../interface';
import { BasePieChartSpecTransformer } from './pie-transformer';

export class BasePieChart<T extends IPieChartSpec> extends BaseChart<AdaptiveSpec<T, 'axes'>> {
  static readonly transformerConstructor = BasePieChartSpecTransformer;
  // @ts-ignore
  readonly transformerConstructor = BasePieChartSpecTransformer;
}
