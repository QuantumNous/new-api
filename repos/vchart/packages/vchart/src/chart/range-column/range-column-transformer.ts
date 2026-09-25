import { Direction } from '../../typings';
import { CartesianChartSpecTransformer } from '../cartesian';
import { setDefaultCrosshairForCartesianChart } from '../util';
import type { IRangeColumnChartSpec } from './interface';

export class RangeColumnChartSpecTransformer<
  T extends IRangeColumnChartSpec = IRangeColumnChartSpec
> extends CartesianChartSpecTransformer<T> {
  protected _getDefaultSeriesSpec(spec: T): any {
    const series: any = super._getDefaultSeriesSpec(spec, [
      'barWidth',
      'barMaxWidth',
      'barMinWidth',
      'barGapInGroup',
      'barBackground',
      'barMinHeight',
      'stackCornerRadius',
      'bar'
    ]);

    if (spec.direction === Direction.horizontal) {
      series.xField = spec.xField ?? [spec.minField, spec.maxField];
    } else {
      series.yField = spec.yField ?? [spec.minField, spec.maxField];
    }
    return series;
  }

  transformSpec(spec: T): void {
    super.transformSpec(spec);
    setDefaultCrosshairForCartesianChart(spec);
  }
}
