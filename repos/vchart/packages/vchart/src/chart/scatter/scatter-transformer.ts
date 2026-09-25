import { CartesianChartSpecTransformer } from '../cartesian';
import type { IScatterChartSpec } from './interface';

export class ScatterChartSpecTransformer<
  T extends IScatterChartSpec = IScatterChartSpec
> extends CartesianChartSpecTransformer<T> {
  protected _getDefaultSeriesSpec(spec: IScatterChartSpec): any {
    return super._getDefaultSeriesSpec(spec, ['point', 'size', 'shape', 'shapeField', 'sizeField']);
  }
}
