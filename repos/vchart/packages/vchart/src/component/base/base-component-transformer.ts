import { BaseModelSpecTransformer } from '../../model';
import { normalizeLayoutPaddingSpec } from '../../util';
import type { ComponentTypeEnum } from '../interface';
import type { IComponentSpec } from './interface';
import { getComponentThemeFromGlobalTheme } from './util';

export class BaseComponentSpecTransformer<
  T extends IComponentSpec = IComponentSpec,
  K = any
> extends BaseModelSpecTransformer<T, K> {
  getTheme(spec: T, chartSpec: any): K {
    return getComponentThemeFromGlobalTheme(this.type as ComponentTypeEnum, this._option.getTheme, spec, chartSpec);
  }

  protected _mergeThemeToSpec(spec: T, chartSpec: any): { spec: T; theme: K } {
    const { spec: newSpec, theme } = super._mergeThemeToSpec(spec, chartSpec);
    this._adjustPadding(newSpec);
    return { spec: newSpec, theme };
  }

  protected _adjustPadding(spec: T) {
    // 默认忽略外侧 padding
    const { padding, noOuterPadding = true, orient } = spec;
    if (noOuterPadding && padding && orient) {
      spec.padding = {
        ...normalizeLayoutPaddingSpec(padding),
        [orient]: 0
      };
    }
  }
}
