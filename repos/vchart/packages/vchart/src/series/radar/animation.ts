import type { IGraphic } from '@visactor/vrender-core';
import { ClipAngleAnimate } from '@visactor/vrender-animate/custom/clip-graphic';
import { AnimateExecutor } from '@visactor/vrender-animate/executor/animate-executor';
import { Factory } from '../../core/factory';
import { PolarPointUpdate, PolarTagPointsUpdate } from '../polar/animation';
import { DEFAULT_ANIMATION_CONFIG } from '../../animation/config';
import { registerArc } from '../../vrender-bridge';
import type { IRadarAnimationParams, RadarAppearPreset } from './interface';
import type { IAnimationTypeConfig, MarkAnimationSpec } from '../../animation/interface';
import type { Datum } from '../../typings/common';

export const radarFadeAnimation = (animationType: 'in' | 'out') => ({
  type: animationType === 'in' ? 'fadeIn' : 'fadeOut'
});

export const radarGrowAnimation = (params: IRadarAnimationParams, animationType: 'in' | 'out') => ({
  type: animationType === 'in' ? 'growPointsIn' : 'growPointsOut',
  options: () => ({
    center: params.center()
  })
});

export function radarPresetAnimation(
  params: IRadarAnimationParams,
  preset: RadarAppearPreset,
  animationType: 'in' | 'out'
) {
  switch (preset) {
    case 'fadeIn':
      return radarFadeAnimation(animationType);
    case 'clipIn':
    case 'grow':
    default:
      return radarGrowAnimation(params, animationType);
  }
}

export const radarSymbolMoveAnimation = (params: IRadarAnimationParams, animationType: 'in' | 'out') => {
  const xFrom = () => params.center()?.x;
  const xTo = (datum: Datum, element: IGraphic) => element.getGraphicAttribute('x');
  const yFrom = () => params.center()?.y;
  const yTo = (datum: Datum, element: IGraphic) => element.getGraphicAttribute('y');
  if (animationType === 'in') {
    return {
      channel: {
        x: { from: xFrom, to: xTo },
        y: { from: yFrom, to: yTo }
      }
    };
  }
  return {
    channel: {
      x: { from: xTo, to: xFrom },
      y: { from: yTo, to: yFrom }
    }
  };
};

export function radarSymbolPresetAnimation(
  params: IRadarAnimationParams,
  preset: RadarAppearPreset,
  animationType: 'in' | 'out'
) {
  switch (preset) {
    case 'fadeIn':
      return radarFadeAnimation(animationType);
    case 'clipIn':
    case 'grow':
    default:
      return radarSymbolMoveAnimation(params, animationType);
  }
}

export const radarGroupClipAnimation = (
  params: IRadarAnimationParams,
  animationType: 'in' | 'out'
): IAnimationTypeConfig => {
  return {
    custom: ClipAngleAnimate,
    customParameters: (datum: any, graphic: IGraphic) => {
      return {
        group: graphic,
        startAngle: params.startAngle ?? Math.PI / 2,
        orient: 'clockwise',
        center: params.center(),
        radius: params.radius(),
        animationType
      };
    }
  };
};

export const registerRadarAnimation = () => {
  Factory.registerAnimation('radar', (params: IRadarAnimationParams, preset: RadarAppearPreset) => {
    return {
      appear: preset === 'clipIn' ? undefined : radarPresetAnimation(params, preset, 'in'),
      enter: radarPresetAnimation(params, preset, 'in'),
      exit: radarPresetAnimation(params, preset, 'out'),
      disappear: preset === 'clipIn' ? undefined : { duration: DEFAULT_ANIMATION_CONFIG.disappear.duration },
      update: [
        {
          channel: ['points', 'center'],
          custom: PolarTagPointsUpdate,
          customParameters: params,
          duration: DEFAULT_ANIMATION_CONFIG.update.duration,
          easing: DEFAULT_ANIMATION_CONFIG.update.easing
        },
        {
          type: 'update',
          options: { excludeChannels: ['points', 'defined', 'center'] }
        }
      ]
    } as MarkAnimationSpec;
  });
  Factory.registerAnimation(
    'radarSymbol',
    (params: IRadarAnimationParams, preset: RadarAppearPreset) =>
      ({
        appear: preset === 'clipIn' ? undefined : radarSymbolPresetAnimation(params, preset, 'in'),
        enter: { type: 'scaleIn' },
        exit: { type: 'scaleOut' },
        disappear: preset === 'clipIn' ? undefined : { duration: DEFAULT_ANIMATION_CONFIG.disappear.duration },
        update: [
          {
            options: { excludeChannels: ['x', 'y', 'center'] }
          },
          {
            channel: ['x', 'y', 'center'],
            custom: PolarPointUpdate,
            customParameters: params,
            duration: DEFAULT_ANIMATION_CONFIG.update.duration,
            easing: DEFAULT_ANIMATION_CONFIG.update.easing
          }
        ]
      } as MarkAnimationSpec)
  );
  Factory.registerAnimation('radarGroup', (params: IRadarAnimationParams, preset: RadarAppearPreset) => {
    return {
      appear: radarGroupClipAnimation(params, 'in'),
      disappear: { duration: DEFAULT_ANIMATION_CONFIG.disappear.duration }
    };
  });
  registerArc(); // clipAngle animation will use arc graphic
};
