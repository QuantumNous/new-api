import type { BarAppearPreset, IBarAnimationParams } from '@visactor/vchart';
import { barGrowIn, barGrowOut, barPresetAnimation, Factory } from '@visactor/vchart';

export const registerBar3dAnimation = () => {
  Factory.registerAnimation('bar3d', (params: IBarAnimationParams, preset: BarAppearPreset) => {
    return {
      appear: barPresetAnimation(params, preset),
      enter: barGrowIn(params, false),
      exit: barGrowOut(params, false),
      disappear: barGrowOut(params)
    };
  });
};
