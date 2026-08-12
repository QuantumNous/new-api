import type { ISeriesSpec } from '../../typings';
import { BaseSeriesSpecTransformer } from '../base';
import { SeriesMarkNameEnum } from '../interface';
import type { ITreemapSeriesSpec, ITreemapSeriesTheme } from './interface';

export class TreemapSeriesSpecTransformer<
  T extends ISeriesSpec = Omit<ITreemapSeriesSpec, 'data'>,
  K extends ITreemapSeriesTheme = ITreemapSeriesTheme
> extends BaseSeriesSpecTransformer<T, K> {
  protected _transformLabelSpec(spec: T): void {
    this._addMarkLabelSpec(spec, SeriesMarkNameEnum.nonLeaf, 'nonLeafLabel' as any, 'initNonLeafLabelMarkStyle' as any);
    this._addMarkLabelSpec(spec, SeriesMarkNameEnum.leaf);
  }
}
