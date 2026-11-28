import { CartesianChartSpecTransformer } from '../cartesian';
import { setDefaultCrosshairForCartesianChart } from '../util';
import type { ILineChartSpec } from './interface';

export class LineChartSpecTransformer<T extends ILineChartSpec> extends CartesianChartSpecTransformer<T> {
  protected _getDefaultSeriesSpec(spec: T): any {
    const seriesSpec = super._getDefaultSeriesSpec(spec, [
      'point',
      'line',
      'activePoint',
      'sampling',
      'samplingFactor',
      'pointDis',
      'pointDisMul',
      'markOverlap',
      'lineLabel'
    ]);
    seriesSpec.seriesMark = spec.seriesMark ?? 'line';
    return seriesSpec;
  }
  transformSpec(spec: T): void {
    super.transformSpec(spec);
    setDefaultCrosshairForCartesianChart(spec);
  }
}
