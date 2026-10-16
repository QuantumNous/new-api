import { Factory } from '../../core/factory';
import { FadeInOutAnimation } from '../../animation/config';
import type { HeatmapAppearPreset } from './interface';
import type { IAnimationTypeConfig } from '../../animation/interface';

export function heatmapPresetAnimation(preset: HeatmapAppearPreset | boolean): IAnimationTypeConfig {
  if (preset === false) {
    return {};
  }
  return {
    type: 'fadeIn'
  };
}

export const registerHeatmapAnimation = () => {
  Factory.registerAnimation('heatmap', (params: any, preset: HeatmapAppearPreset) => {
    return {
      ...FadeInOutAnimation,
      appear: heatmapPresetAnimation(preset)
    };
  });
};
