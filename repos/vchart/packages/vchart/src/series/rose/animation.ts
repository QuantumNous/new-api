import { Factory } from '../../core/factory';
import type { IRoseAnimationParams, RoseAppearPreset } from './interface';
import type { IAnimationTypeConfig } from '../../animation/interface';
import { DEFAULT_ANIMATION_CONFIG } from '../../animation/config';

function growInType(growField: string) {
  return growField === 'angle' ? 'growAngleIn' : 'growRadiusIn';
}

function growOutType(growField: string) {
  return growField === 'angle' ? 'growAngleOut' : 'growRadiusOut';
}

export const Appear_Grow = (params: IRoseAnimationParams): IAnimationTypeConfig => {
  return {
    type: growInType(params.growField),
    options: {
      overall: true
    }
  };
};

export const Appear_FadeIn: IAnimationTypeConfig = {
  type: 'fadeIn'
};

export const roseEnter = (params: IRoseAnimationParams): IAnimationTypeConfig => {
  return {
    type: growInType(params.growField)
  };
};

export const roseExit = (params: IRoseAnimationParams): IAnimationTypeConfig => {
  return {
    type: growOutType(params.growField)
  };
};

export const roseDisappear = roseExit;

export function rosePresetAnimation(
  params: IRoseAnimationParams,
  preset: RoseAppearPreset | boolean
): IAnimationTypeConfig {
  if (preset === false) {
    return {};
  }
  switch (preset) {
    case 'fadeIn':
      return Appear_FadeIn;
    case 'growAngle':
      return Appear_Grow({
        ...params,
        growField: 'angle'
      });
    default:
      return Appear_Grow({
        ...params,
        growField: 'radius'
      });
  }
}

export const registerRoseAnimation = () => {
  Factory.registerAnimation('rose', (params: IRoseAnimationParams, preset: RoseAppearPreset) => {
    return {
      appear: rosePresetAnimation(params, preset),
      enter: roseEnter(params),
      exit: roseExit(params),
      disappear: { duration: DEFAULT_ANIMATION_CONFIG.disappear.duration }
    };
  });
};
