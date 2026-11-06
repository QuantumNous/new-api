import { isObject } from '@visactor/vutils';
import type { IBarSeriesSpec } from '../../series';
import { CartesianChartSpecTransformer } from '../cartesian';
import { setDefaultCrosshairForCartesianChart } from '../util';
import type { IBarChartSpec } from './interface';
import type { ICartesianBandAxisSpec } from '../../component';

export class BarChartSpecTransformer<T extends IBarChartSpec = IBarChartSpec> extends CartesianChartSpecTransformer<T> {
  protected _getDefaultSeriesSpec(spec: T): any {
    return super._getDefaultSeriesSpec(spec, [
      'barWidth',
      'barMaxWidth',
      'barMinWidth',
      'barGapInGroup',
      'barMinHeight',
      'sampling',
      'samplingFactor',
      'barBackground',
      'stackCornerRadius',
      'useSequentialAnimation'
    ]) as IBarSeriesSpec;
  }

  transformSpec(spec: T): void {
    super.transformSpec(spec);
    setDefaultCrosshairForCartesianChart(spec);
  }

  protected _transformAxisSpec(spec: T) {
    super._transformAxisSpec(spec);
    if (!spec.axes) {
      return;
    }
    const isHorizontal = spec.series.some(series => series.direction === 'horizontal');
    const bandAxis: ICartesianBandAxisSpec =
      spec.axes.find(axis => axis.type === 'band') ??
      spec.axes.find(axis => (isHorizontal ? ['left', 'right'] : ['top', 'bottom']).includes(axis.orient));
    if (bandAxis && !bandAxis.bandSize && !bandAxis.maxBandSize && !bandAxis.minBandSize) {
      // 将 autoBandSize 应用在轴上
      if (!!spec.autoBandSize) {
        const extend = isObject(spec.autoBandSize) ? spec.autoBandSize.extend ?? 0 : 0;
        const { barMaxWidth, barMinWidth, barWidth, barGapInGroup } = spec.series.find(
          series => series.type === 'bar'
        ) as IBarSeriesSpec;
        this._applyAxisBandSize(bandAxis, extend, { barMaxWidth, barMinWidth, barWidth, barGapInGroup });
      }
    }
  }
}
