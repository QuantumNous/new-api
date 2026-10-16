import { BaseSeriesSpecTransformer } from '../base';
import { SeriesMarkNameEnum } from '../interface';
import type { IMapSeriesSpec, IMapSeriesTheme } from './interface';

export class MapSeriesSpecTransformer<
  T extends IMapSeriesSpec = IMapSeriesSpec,
  K extends IMapSeriesTheme = IMapSeriesTheme
> extends BaseSeriesSpecTransformer<T, K> {
  protected _transformLabelSpec(spec: T): void {
    this._addMarkLabelSpec(spec, SeriesMarkNameEnum.area, undefined, undefined, false); // 地图交互通过 vrender api，自身不支持动画，所以 label 也不支持动画
  }
}
