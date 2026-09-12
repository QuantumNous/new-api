import type { ICartesianAxisCommonSpec } from '../../../component/axis';
import { CartesianChartSpecTransformer } from '../../cartesian';
import type { IHistogramChartSpec } from '../interface';

export class BaseHistogramChartSpecTransformer<T extends IHistogramChartSpec> extends CartesianChartSpecTransformer<T> {
  transformSpec(spec: T): void {
    super.transformSpec(spec);
    spec.axes.forEach((axis: ICartesianAxisCommonSpec) => (axis.type = 'linear'));
  }

  protected _getDefaultSeriesSpec(spec: T): any {
    return super._getDefaultSeriesSpec(spec, ['x2Field', 'y2Field', 'barMinHeight', 'barBackground', 'barGap']);
  }
}
