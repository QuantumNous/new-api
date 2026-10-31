import type { IBar3dSeriesSpec, IBar3dSeriesTheme } from './interface';
import { SeriesMark3dNameEnum } from '../3d/enum';
import { BarSeriesSpecTransformer } from '@visactor/vchart';

export class Bar3dSeriesSpecTransformer<
  T extends IBar3dSeriesSpec = IBar3dSeriesSpec,
  K extends IBar3dSeriesTheme = IBar3dSeriesTheme
  // @ts-ignore
> extends BarSeriesSpecTransformer<T, K> {
  protected _transformLabelSpec(spec: T): void {
    this._addMarkLabelSpec(spec, SeriesMark3dNameEnum.bar3d);
  }
}
