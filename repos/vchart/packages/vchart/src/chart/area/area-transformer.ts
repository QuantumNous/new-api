import { CartesianChartSpecTransformer } from '../cartesian';
import { setDefaultCrosshairForCartesianChart } from '../util';
import type { IAreaChartSpec } from './interface';

export class AreaChartSpecTransformer<
  T extends IAreaChartSpec = IAreaChartSpec
> extends CartesianChartSpecTransformer<T> {
  protected _getDefaultSeriesSpec(spec: T): any {
    return super._getDefaultSeriesSpec(spec, [
      'point',
      'line',
      'area',
      'seriesMark',
      'activePoint',
      'sampling',
      'samplingFactor',
      'pointDis',
      'pointDisMul',
      'markOverlap',
      'areaLabel',
      'useSequentialAnimation'
    ]);
  }

  transformSpec(spec: T): void {
    super.transformSpec(spec);
    setDefaultCrosshairForCartesianChart(spec);
  }
}
