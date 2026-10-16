import { Direction } from '../../typings';
import { CartesianChartSpecTransformer } from '../cartesian';
import { setDefaultCrosshairForCartesianChart } from '../util';
import type { IRangeAreaChartSpec } from './interface';

export class RangeAreaChartSpecTransformer<
  T extends IRangeAreaChartSpec = IRangeAreaChartSpec
> extends CartesianChartSpecTransformer<T> {
  protected _getDefaultSeriesSpec(spec: T): any {
    const series: any = super._getDefaultSeriesSpec(spec);
    this._addSeriesRelatedSpecKeys(['area', 'point', 'line']);
    series.area = spec.area;
    series.point = spec.point;
    series.line = spec.line;
    if (spec.direction === Direction.horizontal) {
      series.xField = spec.xField ?? [spec.minField, spec.maxField];
    } else {
      series.yField = spec.yField ?? [spec.minField, spec.maxField];
    }
    series.stack = false;
    return series;
  }

  transformSpec(spec: T): void {
    super.transformSpec(spec);
    setDefaultCrosshairForCartesianChart(spec);
  }
}
