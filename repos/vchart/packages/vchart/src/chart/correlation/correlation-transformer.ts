import type { ICorrelationSeriesSpec } from '../../series';
// eslint-disable-next-line no-duplicate-imports
import { SeriesTypeEnum } from '../../series';
import { BaseChartSpecTransformer } from '../base';
import type { ICorrelationChartSpec } from './interface';

export class CorrelationChartSpecTransformer<
  T extends ICorrelationChartSpec = ICorrelationChartSpec
> extends BaseChartSpecTransformer<T> {
  protected _getDefaultSeriesSpec(spec: T): any {
    const series: ICorrelationSeriesSpec = super._getDefaultSeriesSpec(spec, [
      'categoryField',
      'valueField',
      'sizeField',
      'sizeRange',
      'centerX',
      'centerY',
      'innerRadius',
      'outerRadius',
      'startAngle',
      'endAngle',
      'ripplePoint',
      'centerPoint',
      'centerLabel',
      'nodePoint'
    ]);

    return series;
  }

  transformSpec(spec: T): void {
    super.transformSpec(spec);
    this.transformSeriesSpec(spec);
  }
}
