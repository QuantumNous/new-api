import { FunnelSeriesSpecTransformer, type AdaptiveSpec } from '@visactor/vchart';
import type { IFunnel3dSeriesSpec, IFunnel3dSeriesTheme } from './interface';
import { SeriesMark3dNameEnum } from '../3d/enum';

export class Funnel3dSeriesSpecTransformer<
  T extends IFunnel3dSeriesSpec = IFunnel3dSeriesSpec,
  K extends IFunnel3dSeriesTheme = IFunnel3dSeriesTheme
> extends FunnelSeriesSpecTransformer<AdaptiveSpec<T, 'type'>, K> {
  protected _transformLabelSpec(spec: AdaptiveSpec<T, 'type'>): void {
    this._addMarkLabelSpec(spec, SeriesMark3dNameEnum.funnel3d);
    if (spec.isTransform) {
      this._addMarkLabelSpec(spec, SeriesMark3dNameEnum.transform3d, 'transformLabel' as any);
    }
  }
}
