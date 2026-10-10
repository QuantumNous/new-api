import { registerLineAnimation, registerAreaAnimation, registerScaleInOutAnimation } from '../../animation/config';
import type { IAnimationTypeConfig } from '../../animation/interface';
import { Direction } from '../../typings/space';
import type { AreaAppearPreset, IAreaAnimationParams } from './interface';

const Appear_ClipIn: IAnimationTypeConfig = {
  type: 'clipIn'
};

const Appear_Grow = (params: IAreaAnimationParams): IAnimationTypeConfig => {
  return {
    type: params.direction === Direction.horizontal ? 'growPointsXIn' : 'growPointsYIn',
    options: {
      orient: params.direction === Direction.horizontal ? 'positive' : 'negative'
    }
  };
};

const Appear_FadeIn: IAnimationTypeConfig = {
  type: 'fadeIn'
};

export function areaPresetAnimation(
  params: IAreaAnimationParams,
  preset: AreaAppearPreset | boolean
): IAnimationTypeConfig {
  if (preset === false) {
    return {};
  }
  switch (preset) {
    case 'grow':
      return Appear_Grow(params);
    case 'fadeIn':
      return Appear_FadeIn;
    default:
      return Appear_ClipIn;
  }
}

export const registerAreaSeriesAnimation = () => {
  registerAreaAnimation();
  registerLineAnimation();
  registerScaleInOutAnimation();
};
