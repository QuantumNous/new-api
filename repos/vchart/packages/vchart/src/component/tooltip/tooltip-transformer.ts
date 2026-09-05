import { vglobal } from '../../vrender-bridge';
import type { IChartSpecInfo } from '../../chart/interface';
import { domDocument, isMiniAppLikeMode, isString, isTrueBrowser, isValid } from '../../util';
import { BaseComponentSpecTransformer } from '../base';
import { TOOLTIP_EL_CLASS_NAME } from './constant';
import { getTooltipActualActiveType } from './utils/common';
import { mergeSpec } from '@visactor/vutils-extension';

const TOOLTIP_STYLE_THEME_KEYS = [
  'panel',
  'shape',
  'titleLabel',
  'keyLabel',
  'valueLabel',
  'spaceRow',
  'maxContentHeight',
  'align'
] as const;

export class TooltipSpecTransformer extends BaseComponentSpecTransformer<any> {
  protected _shouldMergeThemeToSpec() {
    return false;
  }

  protected _initTheme(spec: any, chartSpec: any): { spec: any; theme: any } {
    const { spec: newSpec, theme } = super._initTheme(spec, chartSpec);
    const themeStyle = mergeSpec(
      {},
      ...TOOLTIP_STYLE_THEME_KEYS.map(key => (theme?.[key] !== undefined ? { [key]: theme[key] } : undefined)),
      theme?.style
    );
    const themeSpec = mergeSpec({}, theme);

    TOOLTIP_STYLE_THEME_KEYS.forEach(key => {
      delete themeSpec[key];
    });
    delete themeSpec.style;

    const mergedSpec = mergeSpec({}, themeSpec, newSpec);

    // 合并样式配置
    mergedSpec.style = mergeSpec({}, themeStyle, mergedSpec.style);

    return { spec: mergedSpec, theme };
  }

  protected _transformSpecAfterMergingTheme(spec: any, chartSpec: any, chartSpecInfo?: IChartSpecInfo) {
    super._transformSpecAfterMergingTheme(spec, chartSpec, chartSpecInfo);

    spec.visible = spec.visible ?? true;
    spec.activeType = getTooltipActualActiveType(spec);
    spec.renderMode =
      spec.renderMode ??
      // 小程序或非浏览器环境下，默认使用canvas渲染
      (isMiniAppLikeMode(this._option.mode) || !isTrueBrowser(this._option.mode) ? 'canvas' : 'html');
    spec.trigger = spec.trigger ?? 'hover';
    spec.className = spec.className ?? TOOLTIP_EL_CLASS_NAME;
    spec.enterable = spec.enterable ?? false;
    spec.transitionDuration = spec.transitionDuration ?? 150;
    spec.confine = spec.confine ?? spec.renderMode === 'canvas';

    if (isValid(spec.parentElement)) {
      if (isString(spec.parentElement)) {
        spec.parentElement = vglobal.getElementById(spec.parentElement);
      }
    } else if (isTrueBrowser(this._option.mode)) {
      spec.parentElement = domDocument?.body;
    }
  }
}
