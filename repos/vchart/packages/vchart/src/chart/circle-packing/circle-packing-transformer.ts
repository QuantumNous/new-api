import type { ICirclePackingSeriesSpec } from '../../series/circle-packing/interface';
import { BaseChartSpecTransformer } from '../base';
import type { ICirclePackingChartSpec } from './interface';

export class CirclePackingChartSpecTransformer<
  T extends ICirclePackingChartSpec = ICirclePackingChartSpec
> extends BaseChartSpecTransformer<T> {
  protected _getDefaultSeriesSpec(spec: ICirclePackingChartSpec) {
    const series: ICirclePackingSeriesSpec = super._getDefaultSeriesSpec(spec, [
      'categoryField',
      'valueField',
      'layoutPadding',
      'circlePacking',
      'drill',
      'drillField'
    ]);

    return series;
  }

  transformSpec(spec: T): void {
    super.transformSpec(spec);
    this.transformSeriesSpec(spec);
  }
}
