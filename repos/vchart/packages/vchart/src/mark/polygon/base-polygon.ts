import type { ICommonSpec } from '../../typings/visual';
import { BaseMark } from '../base/base-mark';
import type { IMarkStyle } from '../interface';

export class BasePolygonMark<T extends ICommonSpec> extends BaseMark<T> {
  protected _getDefaultStyle() {
    const defaultStyle: IMarkStyle<T> = {
      ...super._getDefaultStyle(),
      points: []
    };
    return defaultStyle;
  }
}
