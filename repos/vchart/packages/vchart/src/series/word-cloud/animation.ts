import { DEFAULT_ANIMATION_CONFIG } from '../../animation/config';
import { Factory } from '../../core/factory';
import type { IWordcloudAnimationParams, WordcloudAppearPreset } from './interface';
import type { IAnimationTypeConfig } from '../../animation/interface';

function computeWordDelay(duration: number, totalTime: number, wordCount: number) {
  if (duration * wordCount < totalTime) {
    return duration + (totalTime - wordCount * duration) / (wordCount - 1);
  }
  return (totalTime - duration) / (wordCount - 1);
}

export const WordCloudScaleInAnimation = (params: IWordcloudAnimationParams): IAnimationTypeConfig => {
  return {
    type: 'scaleIn',
    options: {
      fromScale: 0
    },
    duration: 200,
    delay: (datum, graphic) => {
      const animationConfig = params.animationConfig();
      const duration = animationConfig?.duration || 200;
      const totalTime = animationConfig?.totalTime || DEFAULT_ANIMATION_CONFIG.appear.duration;
      const count = graphic.context.graphicCount;
      const index = graphic.context.graphicIndex;
      return index * computeWordDelay(duration as number, totalTime as number, count);
    }
  };
};

export function wordcloudPresetAnimation(
  params: IWordcloudAnimationParams,
  preset: WordcloudAppearPreset | boolean
): IAnimationTypeConfig {
  if (preset === false) {
    return {};
  }
  switch (preset) {
    case 'fadeIn':
      return { type: 'fadeIn' };
    case 'scaleIn':
    default:
      return WordCloudScaleInAnimation(params);
  }
}

export const registerWordCloudAnimation = () => {
  Factory.registerAnimation('wordCloud', (params: IWordcloudAnimationParams, preset: WordcloudAppearPreset) => ({
    appear: wordcloudPresetAnimation(params, preset),
    enter: { type: 'fadeIn' },
    exit: { type: 'fadeOut' },
    disappear: { duration: DEFAULT_ANIMATION_CONFIG.disappear.duration }
  }));
};
