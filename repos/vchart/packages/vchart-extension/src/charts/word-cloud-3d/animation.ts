import { RotateBySphereAnimate } from '@visactor/vchart';
import type { IWordcloud3dAnimationParams } from './interface';
import type { IAnimationTypeConfig } from '@visactor/vchart';
import { Factory } from '@visactor/vchart';

export const WordCloud3dAnimation = (params: IWordcloud3dAnimationParams | (() => any)): IAnimationTypeConfig => {
  return {
    custom: RotateBySphereAnimate,
    customParameters: () => params,
    easing: 'linear',
    loop: Infinity,
    duration: 6000
  };
};

export const registerWordCloud3dAnimation = () => {
  Factory.registerAnimation('wordCloud3d', (params: IWordcloud3dAnimationParams) => ({
    appear: WordCloud3dAnimation(params)
  }));
};
