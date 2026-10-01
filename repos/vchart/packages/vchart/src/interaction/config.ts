import { mergeSpec } from '@visactor/vutils-extension';
import type { RenderMode } from '../typings/spec/common';
import { RenderModeEnum } from '../typings/spec/common';
import { isMiniAppLikeMode, isMobileLikeMode } from '../util';
import type { IHoverSpec, ISelectSpec } from './interface/spec';
import { isBoolean, isObject } from '@visactor/vutils';

export function getDefaultInteractionConfigByMode(mode: RenderMode) {
  if (mode === RenderModeEnum['desktop-browser'] || mode === RenderModeEnum['desktop-miniApp']) {
    return {
      hover: {
        enable: true,
        trigger: 'pointermove',
        triggerOff: 'view:pointerleave'
      },
      select: {
        enable: true,
        trigger: 'pointertap'
      }
    };
  }

  if (isMobileLikeMode(mode) || isMiniAppLikeMode(mode)) {
    return {
      hover: {
        enable: true,
        trigger: ['pointerdown', 'pointermove'],
        triggerOff: 'view:pointerleave'
      },
      select: {
        enable: true,
        trigger: 'tap'
      }
    };
  }

  return null;
}

export const parseHoverSelect = (mode: RenderMode, hoverSpec: IHoverSpec, selectSpec: ISelectSpec) => {
  const defaultConfig = getDefaultInteractionConfigByMode(mode);
  let finalHoverSpec = { ...defaultConfig?.hover };
  let finalSelectSpec: ISelectSpec = { ...defaultConfig?.select };

  if (isBoolean(hoverSpec)) {
    finalHoverSpec.enable = hoverSpec as boolean;
  } else if (isObject(hoverSpec)) {
    finalHoverSpec.enable = true;
    finalHoverSpec = mergeSpec(finalHoverSpec, hoverSpec);
  }

  if (isBoolean(selectSpec)) {
    finalSelectSpec.enable = selectSpec as boolean;
  } else if (isObject(selectSpec)) {
    finalSelectSpec.enable = true;
    finalSelectSpec = mergeSpec(finalSelectSpec, selectSpec);
  }

  return {
    select: finalSelectSpec,
    hover: finalHoverSpec
  };
};
