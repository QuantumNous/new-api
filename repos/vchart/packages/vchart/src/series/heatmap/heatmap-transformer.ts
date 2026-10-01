import { BaseSeriesSpecTransformer } from '../base';
import { SeriesMarkNameEnum } from '../interface';
import type { IHeatmapSeriesSpec, IHeatmapSeriesTheme } from './interface';

export class HeatmapSeriesSpecTransformer<
  T extends IHeatmapSeriesSpec = IHeatmapSeriesSpec,
  K extends IHeatmapSeriesTheme = IHeatmapSeriesTheme
> extends BaseSeriesSpecTransformer<T, K> {
  protected _transformLabelSpec(spec: T): void {
    this._addMarkLabelSpec(spec, SeriesMarkNameEnum.cell);
  }
}
