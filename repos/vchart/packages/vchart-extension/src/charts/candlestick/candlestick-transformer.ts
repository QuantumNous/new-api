import { CartesianChartSpecTransformer, setDefaultCrosshairForCartesianChart } from '@visactor/vchart';
import type { ICandlestickChartSpec } from './interface';

export class CandlestickChartSpecTransformer<
  T extends ICandlestickChartSpec = ICandlestickChartSpec
> extends CartesianChartSpecTransformer<T> {
  protected _getDefaultSeriesSpec(spec: T): any {
    const dataFields = [spec.openField, spec.highField, spec.lowField, spec.closeField];
    const seriesSpec = super._getDefaultSeriesSpec(spec, [
      'candlestick',
      'openField',
      'highField',
      'lowField',
      'closeField',
      'rising',
      'falling',
      'doji'
    ]);
    seriesSpec.yField = dataFields;
    return seriesSpec;
  }

  transformSpec(spec: T): void {
    super.transformSpec(spec);
    if (!spec.axes) {
      spec.axes = [
        {
          orient: 'bottom'
        },
        {
          orient: 'left'
        }
      ];
    }
    setDefaultCrosshairForCartesianChart(spec);
  }
}
