import type { IAnimationTypeConfig } from '../../../animation/interface';
import { Factory } from '../../../core/factory';
import { DEFAULT_ANIMATION_CONFIG } from '../../../animation/config';
import type { IProgressLikeAnimationParams, ProgressLikeAppearPreset } from './interface';

const Appear_Grow = (params: IProgressLikeAnimationParams): IAnimationTypeConfig => ({
  type: 'growAngleIn',
  options: {
    overall: params.startAngle
  }
});

const Appear_FadeIn: IAnimationTypeConfig = {
  type: 'fadeIn'
};

export function progressLikePresetAnimation(params: IProgressLikeAnimationParams, preset: ProgressLikeAppearPreset) {
  switch (preset) {
    case 'fadeIn':
      return Appear_FadeIn;
    default:
      return Appear_Grow(params);
  }
}

export const registerProgressLikeAnimation = () => {
  Factory.registerAnimation(
    'circularProgress',
    (params: IProgressLikeAnimationParams, preset: ProgressLikeAppearPreset) => ({
      appear: progressLikePresetAnimation(params, preset),
      enter: { type: 'growAngleIn' },
      disappear: { duration: DEFAULT_ANIMATION_CONFIG.disappear.duration }
    })
  );
};
