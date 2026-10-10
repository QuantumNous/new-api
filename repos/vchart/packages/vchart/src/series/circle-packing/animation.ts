import type { IAnimationTypeConfig } from '../../animation/interface';
import { Factory } from '../../core/factory';
import { DEFAULT_ANIMATION_CONFIG } from '../../animation/config';
import type { CirclePackingAppearPreset } from './interface';

export const circlePackingPresetAnimation = (preset: CirclePackingAppearPreset): IAnimationTypeConfig => {
  switch (preset) {
    case 'fadeIn': {
      return {
        type: 'fadeIn'
      };
    }

    default: {
      return {
        type: 'growRadiusIn'
      };
    }
  }
};

export const registerCirclePackingAnimation = () => {
  Factory.registerAnimation('circlePacking', (parmas: unknown, preset: CirclePackingAppearPreset) => ({
    appear: circlePackingPresetAnimation(preset),
    enter: { type: 'growRadiusIn' },
    exit: { type: 'growRadiusOut' },
    disappear: { duration: DEFAULT_ANIMATION_CONFIG.disappear.duration }
  }));
};
