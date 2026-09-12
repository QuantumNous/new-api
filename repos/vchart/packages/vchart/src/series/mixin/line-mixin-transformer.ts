import type { ISeriesSpec } from '../../typings';
import { BaseSeriesSpecTransformer } from '../base';
import { SeriesMarkNameEnum } from '../interface';

export class LineLikeSeriesSpecTransformer<T extends ISeriesSpec, K> extends BaseSeriesSpecTransformer<T, K> {
  protected _transformLabelSpec(spec: any): void {
    const isPointVisible = spec.point?.visible !== false && spec.point?.style?.visible !== false;
    if (!isPointVisible) {
      this._addMarkLabelSpec(spec, SeriesMarkNameEnum.line);
    } else {
      this._addMarkLabelSpec(spec, SeriesMarkNameEnum.point);
    }
    this._addMarkLabelSpec(
      spec,
      SeriesMarkNameEnum.line,
      'lineLabel' as any,
      'initLineLabelMarkStyle' as any,
      undefined,
      true
    );
  }
}
