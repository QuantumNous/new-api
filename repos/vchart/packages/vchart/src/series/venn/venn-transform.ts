import type { ISeriesSpec } from '../../typings';
import { BaseSeriesSpecTransformer } from '../base';
import { SeriesMarkNameEnum } from '../interface';
import type { IVennSeriesSpec, IVennSeriesTheme } from './interface';

export class VennSeriesSpecTransformer<
  T extends ISeriesSpec = Omit<IVennSeriesSpec, 'data'>,
  K extends IVennSeriesTheme = IVennSeriesTheme
> extends BaseSeriesSpecTransformer<T, K> {
  protected _transformLabelSpec(spec: T): void {
    this._addMarkLabelSpec(spec, SeriesMarkNameEnum.circle);
    this._addMarkLabelSpec(spec, SeriesMarkNameEnum.overlap, 'overlapLabel' as any, 'initOverlapLabelMarkStyle' as any);
  }
}
