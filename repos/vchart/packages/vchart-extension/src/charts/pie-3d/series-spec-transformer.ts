import { PieSeriesSpecTransformer } from '@visactor/vchart/esm/series/pie/pie-transformer';
import type { IPie3dSeriesSpec, IPie3dSeriesTheme } from './interface';
import { SeriesMark3dNameEnum } from '../3d/enum';

export class Pie3dSeriesSpecTransformer<
  T extends IPie3dSeriesSpec = IPie3dSeriesSpec,
  K extends IPie3dSeriesTheme = IPie3dSeriesTheme
> extends PieSeriesSpecTransformer<T, K> {
  protected _transformLabelSpec(spec: T): void {
    this._addMarkLabelSpec(spec, SeriesMark3dNameEnum.pie3d);
  }
}
