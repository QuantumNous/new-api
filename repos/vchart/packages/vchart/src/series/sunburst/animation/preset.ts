import type { IAnimationTypeConfig } from '../../../animation/interface';
import type { ISunburstAnimationParams, SunburstAppearPreset } from './interface';

/**
 * 预设
 */
export const sunburstPresetAnimation = (
  _params: ISunburstAnimationParams, // 此处仅为保持结构统一
  preset: SunburstAppearPreset
): IAnimationTypeConfig => {
  switch (preset) {
    case 'fadeIn': {
      return {
        type: 'fadeIn'
      };
    }
    case 'growAngle': {
      return {
        type: 'growAngleIn'
      };
    }
    case 'growRadius': {
      return {
        type: 'growRadiusIn'
      };
    }
    default: {
      return {
        type: 'growRadiusIn'
      };
    }
  }
};
