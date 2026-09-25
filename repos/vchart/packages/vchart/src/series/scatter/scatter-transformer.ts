import { BaseSeriesSpecTransformer } from '../base';
import { SeriesMarkNameEnum } from '../interface';
import type { IScatterSeriesSpec, IScatterSeriesTheme } from './interface';

export class ScatterSeriesSpecTransformer<
  T extends IScatterSeriesSpec = IScatterSeriesSpec,
  K extends IScatterSeriesTheme = IScatterSeriesTheme
> extends BaseSeriesSpecTransformer<T, K> {
  protected _transformLabelSpec(spec: T): void {
    this._addMarkLabelSpec(spec, SeriesMarkNameEnum.point);
  }
}
