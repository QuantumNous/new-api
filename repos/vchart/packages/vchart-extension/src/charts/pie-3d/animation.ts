import { Factory } from '@visactor/vchart/esm/core/factory';
import type { IPieAnimationParams, PieAppearPreset } from '@visactor/vchart/esm/series/pie/interface';
import {
  pieDisappear,
  pieEnter,
  pieExit,
  piePresetAnimation
} from '@visactor/vchart/esm/series/pie/animation/animation';

export const registerPie3dAnimation = () => {
  Factory.registerAnimation('pie3d', (params: IPieAnimationParams, preset: PieAppearPreset) => {
    return {
      appear: piePresetAnimation(params, preset),
      enter: pieEnter(params),
      exit: pieExit(params),
      disappear: pieDisappear(params)
    };
  });
};
