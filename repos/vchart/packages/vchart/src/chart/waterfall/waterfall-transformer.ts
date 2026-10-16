import { array } from '@visactor/vutils';
import type { AdaptiveSpec } from '../../typings';
import { BarChartSpecTransformer } from '../bar';
import { setDefaultCrosshairForCartesianChart } from '../util';
import type { IWaterfallChartSpec } from './interface';

export class WaterfallChartSpecTransformer<
  T extends IWaterfallChartSpec = IWaterfallChartSpec
> extends BarChartSpecTransformer<AdaptiveSpec<T, 'type' | 'series' | 'label'>> {
  transformSpec(spec: AdaptiveSpec<T, 'type' | 'series' | 'label'>): void {
    super.transformSpec(spec);
    if (spec.legends) {
      array(spec.legends).forEach((l: any) => {
        l.select = false;
        l.hover = false;
        l.filter = false;
      });
    }

    setDefaultCrosshairForCartesianChart(spec);
  }

  protected _getDefaultSeriesSpec(spec: AdaptiveSpec<T, 'type' | 'series' | 'label'>): any {
    const series = super._getDefaultSeriesSpec(spec);
    this._addSeriesRelatedSpecKeys(['bar', 'stackLabel', 'leaderLine', 'total', 'calculationMode']);
    series.bar = spec.bar;
    series.stackLabel = spec.stackLabel;
    series.leaderLine = spec.leaderLine;
    series.total = spec.total;
    series.calculationMode = spec.calculationMode;

    return series;
  }
}
