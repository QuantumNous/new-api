import { Factory } from '../../core/factory';
import { ScaleInOutAnimation } from '../../animation/config';
import type { IScatterAnimationParams, ScatterAppearPreset } from './interface';
import type { IAnimationTypeConfig } from '../../animation/interface';

export const scatterPresetAnimation = (
  _params: IScatterAnimationParams, // 此处仅为保持结构统一
  preset: ScatterAppearPreset
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

export const registerScatterAnimation = () => {
  Factory.registerAnimation('scatter', (params: IScatterAnimationParams, preset: ScatterAppearPreset) => ({
    appear: scatterPresetAnimation(params, preset),
    ...ScaleInOutAnimation
  }));
};
