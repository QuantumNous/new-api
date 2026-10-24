import { BaseSeriesSpecTransformer } from '../base';
import { SeriesMarkNameEnum } from '../interface';
import type { IBarSeriesSpec, IBarSeriesTheme } from './interface';

export class BarSeriesSpecTransformer<
  T extends IBarSeriesSpec = IBarSeriesSpec,
  K extends IBarSeriesTheme = IBarSeriesTheme
> extends BaseSeriesSpecTransformer<T, K> {
  protected _supportStack: boolean = true;

  protected _transformLabelSpec(spec: T): void {
    this._addMarkLabelSpec(spec, SeriesMarkNameEnum.bar);
  }
}
