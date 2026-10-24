import { CartesianChartSpecTransformer } from '../cartesian';
import type { IHeatmapChartSpec } from './interface';

export class HeatmapChartSpecTransformer<
  T extends IHeatmapChartSpec = IHeatmapChartSpec
> extends CartesianChartSpecTransformer<T> {
  protected _getDefaultSeriesSpec(spec: T): any {
    return super._getDefaultSeriesSpec(spec, ['valueField', 'cell']);
  }
}
