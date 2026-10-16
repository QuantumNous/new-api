import type { IAnimationTypeConfig } from '../../animation/interface';
import { Direction } from '../../typings/space';
import type { ILineAnimationParams, LineAppearPreset } from './interface';

const Appear_ClipIn = (params: ILineAnimationParams): IAnimationTypeConfig => {
  return {
    type: 'clipIn',
    options: {
      clipDimension: params.direction === Direction.horizontal ? 'y' : 'x'
    }
  };
};

const Appear_FadeIn: IAnimationTypeConfig = {
  type: 'fadeIn'
};

const Appear_Grow = (params: ILineAnimationParams): IAnimationTypeConfig => {
  return {
    type: params.direction === Direction.horizontal ? 'growPointsXIn' : 'growPointsYIn',
    options: {
      orient: params.direction === Direction.horizontal ? 'positive' : 'negative'
    }
  };
};

export function linePresetAnimation(params: ILineAnimationParams, preset: LineAppearPreset): IAnimationTypeConfig {
  switch (preset) {
    case 'grow':
      return Appear_Grow(params);
    case 'fadeIn':
      return Appear_FadeIn;
    default:
      return Appear_ClipIn(params);
  }
}
