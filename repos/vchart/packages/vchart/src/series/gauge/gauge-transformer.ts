import { BaseSeriesSpecTransformer } from '../base';
import { SeriesMarkNameEnum } from '../interface';
import type { IGaugeSeriesSpec, IGaugeSeriesTheme } from './interface';

export class GaugeSeriesSpecTransformer<
  T extends IGaugeSeriesSpec = IGaugeSeriesSpec,
  K extends IGaugeSeriesTheme = IGaugeSeriesTheme
> extends BaseSeriesSpecTransformer<T, K> {
  protected _supportStack: boolean = false;

  protected _transformLabelSpec(spec: T): void {
    this._addMarkLabelSpec(spec, SeriesMarkNameEnum.segment);
  }
}
