import { OrdinalScale } from '@visactor/vscale';
import type { ColorSchemeItem, ProgressiveDataScheme } from '../theme/color-scheme/interface';
import { computeActualDataScheme, isProgressiveDataColorScheme } from '../theme/color-scheme/util';

/** vchart 色板 ordinal scale 类型 */
export class ColorOrdinalScale extends OrdinalScale {
  /** range（可能为渐进式色板） */
  protected _range: Array<ColorSchemeItem> | ProgressiveDataScheme<ColorSchemeItem>;

  setSpecified(value?: Record<string, unknown>): this {
    this._specified = value ? { ...value } : {};
    return this;
  }

  range(value?: Array<ColorSchemeItem> | ProgressiveDataScheme<ColorSchemeItem>): this | any {
    if (!value) {
      return super.range();
    }
    this._range = value;
    this._resetRange();
    return this;
  }

  /** domain */
  domain(value?: any[]): this | any {
    if (!value) {
      return super.domain();
    }
    super.domain(value);
    this._resetRange();
    return this;
  }

  /** 重新计算色板 */
  protected _resetRange() {
    if (!isProgressiveDataColorScheme(this._range)) {
      super.range(this._range);
      return;
    }
    const range = computeActualDataScheme(this._range, this._domain);
    super.range(range);
  }
}
