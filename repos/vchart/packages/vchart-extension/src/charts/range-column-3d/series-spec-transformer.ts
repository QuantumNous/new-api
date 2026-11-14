import type { IRangeColumnSeriesTheme } from '@visactor/vchart';
import { PositionEnum, RangeColumnSeriesSpecTransformer } from '@visactor/vchart';
import type { IRangeColumn3dSeriesSpec } from './interface';
import { SeriesMark3dNameEnum } from '../3d/enum';

export class RangeColumn3dSeriesSpecTransformer<
  T extends IRangeColumn3dSeriesSpec = IRangeColumn3dSeriesSpec,
  K extends IRangeColumnSeriesTheme = IRangeColumnSeriesTheme
> extends RangeColumnSeriesSpecTransformer<any, K> {
  protected _transformLabelSpec(spec: T): void {
    const labelPosition = spec.label?.position;
    if (labelPosition !== PositionEnum.bothEnd) {
      this._addMarkLabelSpec(spec, SeriesMark3dNameEnum.bar3d);
    }
  }
}
