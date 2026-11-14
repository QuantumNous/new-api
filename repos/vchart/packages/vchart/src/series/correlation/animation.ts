import { Factory } from '../../core/factory';
import { ScaleInOutAnimation } from '../../animation/config';
import type { CorrelationAppearPreset, ICorrelationAnimationParams } from './interface';
import type { IAnimationTypeConfig } from '../../animation/interface';

export const correlationPresetAnimation = (
  _params: ICorrelationAnimationParams, // 此处仅为保持结构统一
  preset: CorrelationAppearPreset
): IAnimationTypeConfig => {
  switch (preset) {
    case 'fadeIn': {
      return {
        type: 'fadeIn'
      };
    }
    case 'scaleIn': {
      return {
        type: 'scaleIn'
      };
    }
    default: {
      return {
        type: 'scaleIn'
      };
    }
  }
};

export const registerCorrelationAnimation = () => {
  Factory.registerAnimation('correlation', (params: ICorrelationAnimationParams, preset: CorrelationAppearPreset) => ({
    appear: correlationPresetAnimation(params, preset),
    ...ScaleInOutAnimation
  }));
};
