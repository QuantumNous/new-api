import { setDefaultCrosshairForCartesianChart } from '../util';
import { BaseHistogramChartSpecTransformer } from './base';
import type { IHistogramChartSpec } from './interface';

export class HistogramChartSpecTransformer<
  T extends IHistogramChartSpec = IHistogramChartSpec
> extends BaseHistogramChartSpecTransformer<T> {
  transformSpec(spec: T): void {
    super.transformSpec(spec);
    setDefaultCrosshairForCartesianChart(spec);
  }
}
