import { BaseSeriesSpecTransformer } from '../base';
import { SeriesMarkNameEnum } from '../interface';
import type { ISankeySeriesSpec, ISankeySeriesTheme } from './interface';

export class SankeySeriesSpecTransformer<
  T extends ISankeySeriesSpec = ISankeySeriesSpec,
  K extends ISankeySeriesTheme = ISankeySeriesTheme
> extends BaseSeriesSpecTransformer<T, K> {
  protected _transformLabelSpec(spec: T): void {
    this._addMarkLabelSpec(spec, SeriesMarkNameEnum.node);
  }
}
