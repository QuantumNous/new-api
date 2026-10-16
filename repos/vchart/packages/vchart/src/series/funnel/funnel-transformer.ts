import { BaseSeriesSpecTransformer } from '../base';
import { SeriesMarkNameEnum } from '../interface';
import type { IFunnelSeriesSpec, IFunnelSeriesTheme } from './interface';

export class FunnelSeriesSpecTransformer<
  T extends IFunnelSeriesSpec = IFunnelSeriesSpec,
  K extends IFunnelSeriesTheme = IFunnelSeriesTheme
> extends BaseSeriesSpecTransformer<T, K> {
  protected _transformLabelSpec(spec: T): void {
    this._addMarkLabelSpec(spec, SeriesMarkNameEnum.funnel);
    if (spec.isTransform) {
      this._addMarkLabelSpec(spec, SeriesMarkNameEnum.transform, 'transformLabel' as any);
    }
  }
}
