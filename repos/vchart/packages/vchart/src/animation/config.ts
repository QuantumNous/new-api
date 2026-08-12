/* eslint-disable no-duplicate-imports */
import type { IGraphic } from '@visactor/vrender-core';
import { ClipDirectionAnimate } from '@visactor/vrender-animate/custom/clip-graphic';
import { ClipIn, ClipOut } from '@visactor/vrender-animate/custom/clip';
import { AnimateExecutor } from '@visactor/vrender-animate/executor/animate-executor';
import { FadeIn, FadeOut } from '@visactor/vrender-animate/custom/fade';
import { FromTo } from '@visactor/vrender-animate/custom/fromTo';
import { GrowAngleIn, GrowAngleOut } from '@visactor/vrender-animate/custom/growAngle';
import { GrowCenterIn, GrowCenterOut } from '@visactor/vrender-animate/custom/growCenter';
import { GrowHeightIn, GrowHeightOut } from '@visactor/vrender-animate/custom/growHeight';
import {
  GrowPointsIn,
  GrowPointsOut,
  GrowPointsXIn,
  GrowPointsXOut,
  GrowPointsYIn,
  GrowPointsYOut
} from '@visactor/vrender-animate/custom/growPoints';
import { GrowRadiusIn, GrowRadiusOut } from '@visactor/vrender-animate/custom/growRadius';
import { GrowWidthIn, GrowWidthOut } from '@visactor/vrender-animate/custom/growWidth';
import { MoveIn, MoveOut } from '@visactor/vrender-animate/custom/move';
import { RotateIn, RotateOut } from '@visactor/vrender-animate/custom/rotate';
import { ScaleIn, ScaleOut } from '@visactor/vrender-animate/custom/scale';
import { State } from '@visactor/vrender-animate/custom/state';
import { TagPointsUpdate } from '@visactor/vrender-animate/custom/tag-points';
import { Update } from '@visactor/vrender-animate/custom/update';

import type { ILineAnimationParams, LineAppearPreset } from '../series/line/interface';
import { linePresetAnimation } from '../series/line/animation';
import type { MarkAnimationSpec, ICartesianGroupAnimationParams } from './interface';
import { Factory } from '../core/factory';
import { Direction } from '../typings/space';
import { CallbackDisappearAnimate } from './callback-disappear';
import { BuiltIn_DISAPPEAR_ANIMATE_NAME } from '../constant/animate';

export const DEFAULT_ANIMATION_CONFIG = {
  appear: {
    duration: 1000,
    easing: 'cubicOut'
  },
  update: {
    type: 'update',
    duration: 300,
    easing: 'linear'
  },
  enter: {
    duration: 300,
    easing: 'linear'
  },
  exit: {
    duration: 300,
    easing: 'linear'
  },
  disappear: {
    duration: 500,
    easing: 'cubicIn'
  },
  state: {
    duration: 300,
    easing: 'linear'
  }
};

export const ScaleInOutAnimation = {
  appear: { type: 'scaleIn' },
  enter: { type: 'scaleIn' },
  exit: { type: 'scaleOut' }
};

export const FadeInOutAnimation = {
  appear: { type: 'fadeIn' },
  enter: { type: 'fadeIn' },
  exit: { type: 'fadeOut' }
};

export const registerScaleInOutAnimation = () => {
  Factory.registerAnimation('scaleInOut', () => ScaleInOutAnimation);
};

export const registerFadeInOutAnimation = () => {
  Factory.registerAnimation('fadeInOut', () => FadeInOutAnimation);
};

export const registerCartesianGroupClipAnimation = () => {
  Factory.registerAnimation('cartesianGroupClip', (params?: ICartesianGroupAnimationParams) => {
    return {
      appear: {
        custom: ClipDirectionAnimate,
        customParameters: (datum: any, g: IGraphic) => {
          return {
            animationType: 'in',
            group: g,
            direction: params.direction(),
            width: params.width(),
            height: params.height(),
            orient: params.orient()
          };
        }
      }
    };
  });
};

const lineOrAreaAnimation = (params: ILineAnimationParams, preset: LineAppearPreset) => {
  return {
    appear: linePresetAnimation(params, preset),
    enter: { type: 'fadeIn' },
    exit: { type: 'fadeOut' },
    update: [
      {
        type: 'update',
        options: { excludeChannels: ['points', 'defined', 'segments'] }
      },
      {
        channel: ['points', 'segments'],
        custom: TagPointsUpdate,
        duration: DEFAULT_ANIMATION_CONFIG.update.duration,
        easing: DEFAULT_ANIMATION_CONFIG.update.easing,
        customParameters: {
          clipRangeByDimension: params.direction === Direction.horizontal ? 'y' : 'x'
        }
      }
    ]
  } as MarkAnimationSpec;
};

export const registerLineAnimation = () => {
  Factory.registerAnimation('line', lineOrAreaAnimation);
};

export const registerAreaAnimation = () => {
  Factory.registerAnimation('area', lineOrAreaAnimation);
};

export const registerBuiltInAnimation = () => {
  AnimateExecutor.registerBuiltInAnimate('scaleIn', ScaleIn);
  AnimateExecutor.registerBuiltInAnimate('scaleOut', ScaleOut);
  AnimateExecutor.registerBuiltInAnimate('fadeIn', FadeIn);
  AnimateExecutor.registerBuiltInAnimate('fadeOut', FadeOut);
  AnimateExecutor.registerBuiltInAnimate('moveIn', MoveIn);
  AnimateExecutor.registerBuiltInAnimate('moveOut', MoveOut);
  AnimateExecutor.registerBuiltInAnimate('rotateIn', RotateIn);
  AnimateExecutor.registerBuiltInAnimate('rotateOut', RotateOut);
  AnimateExecutor.registerBuiltInAnimate('update', Update);
  AnimateExecutor.registerBuiltInAnimate('state', State);
  AnimateExecutor.registerBuiltInAnimate('fromTo', FromTo);
};

export const registerRectAnimation = () => {
  AnimateExecutor.registerBuiltInAnimate('growHeightIn', GrowHeightIn);
  AnimateExecutor.registerBuiltInAnimate('growHeightOut', GrowHeightOut);
  AnimateExecutor.registerBuiltInAnimate('growWidthIn', GrowWidthIn);
  AnimateExecutor.registerBuiltInAnimate('growWidthOut', GrowWidthOut);
  AnimateExecutor.registerBuiltInAnimate('growCenterIn', GrowCenterIn);
  AnimateExecutor.registerBuiltInAnimate('growCenterOut', GrowCenterOut);
};

export const registerArcAnimation = () => {
  AnimateExecutor.registerBuiltInAnimate('growRadiusIn', GrowRadiusIn);
  AnimateExecutor.registerBuiltInAnimate('growRadiusOut', GrowRadiusOut);
  AnimateExecutor.registerBuiltInAnimate('growAngleIn', GrowAngleIn);
  AnimateExecutor.registerBuiltInAnimate('growAngleOut', GrowAngleOut);
};

export const registerLineOrAreaAnimation = () => {
  AnimateExecutor.registerBuiltInAnimate('growPointsIn', GrowPointsIn);
  AnimateExecutor.registerBuiltInAnimate('growPointsOut', GrowPointsOut);
  AnimateExecutor.registerBuiltInAnimate('growPointsXIn', GrowPointsXIn);
  AnimateExecutor.registerBuiltInAnimate('growPointsXOut', GrowPointsXOut);
  AnimateExecutor.registerBuiltInAnimate('growPointsYIn', GrowPointsYIn);
  AnimateExecutor.registerBuiltInAnimate('growPointsYOut', GrowPointsYOut);
  AnimateExecutor.registerBuiltInAnimate('clipIn', ClipIn);
  AnimateExecutor.registerBuiltInAnimate('clipOut', ClipOut);
};

export const registerPolygonAnimation = () => {
  AnimateExecutor.registerBuiltInAnimate('growPointsOut', GrowPointsOut);
};

export const registerStageAnimation = () => {
  AnimateExecutor.registerBuiltInAnimate(BuiltIn_DISAPPEAR_ANIMATE_NAME, CallbackDisappearAnimate);
};
