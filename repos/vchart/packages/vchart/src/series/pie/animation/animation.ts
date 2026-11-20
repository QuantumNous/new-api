import type { IAnimationTypeConfig } from '../../../animation/interface';
import { AnimationStateEnum } from '../../../animation/interface';
import type { Datum } from '../../../typings';
import { Factory } from '../../../core/factory';
import type { IPieAnimationParams, PieAppearPreset } from '../interface';
import type { IMarkGraphic } from '../../../core';
import { DEFAULT_ANIMATION_CONFIG } from '../../../animation/config';

/**
 * grow生长option
 * 在appear时，所有柱子一起从同一个位置生长，需要growXXXOverall效果；
 * 在enter时，柱子应该从自身位置生长；
 * @param params
 * @param isOverall
 * @returns
 */
export function pieGrowOption(pieParams: IPieAnimationParams, isOverall: boolean, state: AnimationStateEnum) {
  return (datum: Datum, graphic: IMarkGraphic, params: AnimationStateEnum) => {
    if (isOverall) {
      if (pieParams.growField === 'radius') {
        return {
          overall: 0
        };
      }
      return {
        overall: pieParams.growFrom(datum, graphic, state)
      };
    }
    return {
      overall: false
    };
  };
}

export const Appear_Grow = (params: IPieAnimationParams): IAnimationTypeConfig => {
  return {
    type: params.growField === 'radius' ? 'growRadiusIn' : 'growAngleIn',
    options: pieGrowOption(params, true, AnimationStateEnum.appear)
  };
};

export const Appear_FadeIn = {
  type: 'fadeIn'
};

export const pieEnter = (params: IPieAnimationParams): IAnimationTypeConfig => {
  return {
    type: params.growField === 'radius' ? 'growRadiusIn' : 'growAngleIn',
    easing: 'linear',
    options: pieGrowOption(params, true, AnimationStateEnum.enter)
  };
};

export const pieExit = (params: IPieAnimationParams): IAnimationTypeConfig => {
  return {
    type: params.growField === 'radius' ? 'growRadiusOut' : 'growAngleOut',
    easing: 'linear',
    options: pieGrowOption(params, true, AnimationStateEnum.exit)
  };
};

export const pieDisappear = (params: IPieAnimationParams): IAnimationTypeConfig => {
  return {
    type: params.growField === 'radius' ? 'growRadiusOut' : 'growAngleOut',
    options: pieGrowOption(params, true, AnimationStateEnum.exit)
  };
};

export function piePresetAnimation(params: IPieAnimationParams, preset: PieAppearPreset | boolean) {
  if (preset === false) {
    return {};
  }
  switch (preset) {
    case 'fadeIn':
      return Appear_FadeIn;
    case 'growRadius':
      return Appear_Grow({
        ...params,
        growField: 'radius'
      });
    default:
      return Appear_Grow({
        ...params,
        growField: 'angle'
      });
  }
}

export const registerPieAnimation = () => {
  Factory.registerAnimation('pie', (params: IPieAnimationParams, preset: PieAppearPreset) => {
    return {
      appear: piePresetAnimation(params, preset),
      enter: pieEnter(params),
      exit: pieExit(params),
      disappear: { duration: DEFAULT_ANIMATION_CONFIG.disappear.duration }
    };
  });
};

export const registerEmptyCircleAnimation = () => {
  Factory.registerAnimation('emptyCircle', (params: IPieAnimationParams, preset: PieAppearPreset) => {
    return {
      appear: piePresetAnimation(params, preset)
    };
  });
};
