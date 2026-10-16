import type { IAnimationTypeConfig } from '../../animation/interface';
import { Factory } from '../../core/factory';
import { DEFAULT_ANIMATION_CONFIG } from '../../animation/config';
import type { TreemapAppearPreset } from './interface';

export const treemapPresetAnimation = (preset: TreemapAppearPreset): IAnimationTypeConfig => {
  switch (preset) {
    case 'fadeIn': {
      return {
        type: 'fadeIn'
      };
    }
    case 'growIn': {
      return {
        type: 'growCenterIn'
      };
    }
    default: {
      return {
        type: 'growCenterIn'
      };
    }
  }
};
export const registerTreemapAnimation = () => {
  Factory.registerAnimation('treemap', (params: unknown, preset: TreemapAppearPreset) => {
    return {
      appear: treemapPresetAnimation(preset),
      enter: { type: 'growCenterIn' },
      exit: { type: 'growCenterOut' },
      disappear: { duration: DEFAULT_ANIMATION_CONFIG.disappear.duration }
    };
  });
};
