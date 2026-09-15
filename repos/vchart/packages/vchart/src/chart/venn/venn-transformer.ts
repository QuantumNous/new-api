import type { AdaptiveSpec } from '../../typings';
import { BaseChartSpecTransformer } from '../base';
import type { IVennChartSpec } from './interface';

export class VennChartSpecTransformer<T extends IVennChartSpec = IVennChartSpec> extends BaseChartSpecTransformer<
  AdaptiveSpec<T, 'data' | 'series'>
> {
  protected _getDefaultSeriesSpec(spec: T): any {
    const series: any = super._getDefaultSeriesSpec(spec, [
      'categoryField',
      'valueField',
      'circle',
      'overlap',
      'overlapLabel'
    ]);

    return series;
  }

  transformSpec(spec: any): void {
    super.transformSpec(spec);
    this.transformSeriesSpec(spec);
  }
}
