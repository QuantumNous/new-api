import type { IAnimationTypeConfig } from '../../animation/interface';
import { Factory } from '../../core/factory';
import type { ILiquidAnimationParams, LiquidAppearPreset } from './interface';

const Appear_Wave: IAnimationTypeConfig = {
  duration: 2000,
  loop: true,
  channel: {
    wave: { from: 0, to: 1 }
  }
};

const Appear_Grow = (params: ILiquidAnimationParams): IAnimationTypeConfig => {
  return {
    duration: 2000,
    channel: {
      wave: { from: 0, to: 1 },
      height: params.height,
      dy: params.dy
    }
  };
};

const Appear_WaveGrow = Appear_Grow;

const Appear_Group_Grow = (params: ILiquidAnimationParams): IAnimationTypeConfig => {
  return {
    duration: 2000,
    channel: {
      dy: params.dy
    }
  };
};

const Appear_Group_WaveGrow = (params: ILiquidAnimationParams): IAnimationTypeConfig => {
  return {
    duration: 2000,
    channel: {
      dy: params.dy
    }
  };
};

export function liquidPresetAnimation(
  params: ILiquidAnimationParams,
  preset: LiquidAppearPreset
): IAnimationTypeConfig {
  switch (preset) {
    case 'wave':
      return Appear_Wave;
    case 'grow':
      return Appear_Grow(params);
    case 'waveGrow':
      return Appear_WaveGrow(params);
    default:
      return Appear_Wave;
  }
}

export function liquidGroupPresetAnimation(
  params: ILiquidAnimationParams,
  preset: LiquidAppearPreset
): IAnimationTypeConfig {
  switch (preset) {
    case 'wave':
      return Appear_Wave;
    case 'grow':
      return Appear_Group_Grow(params);
    case 'waveGrow':
      return Appear_Group_WaveGrow(params);
    default:
      return Appear_Wave;
  }
}

export const registerLiquidAnimation = () => {
  Factory.registerAnimation('liquid', (params: ILiquidAnimationParams, preset: LiquidAppearPreset) => {
    return {
      appear: liquidPresetAnimation(params, preset),
      enter: liquidPresetAnimation(params, preset),
      exit: liquidPresetAnimation(params, preset)
    };
  });

  Factory.registerAnimation('liquidGroup', (params: ILiquidAnimationParams, preset: LiquidAppearPreset) => {
    return {
      appear: liquidGroupPresetAnimation(params, preset),
      enter: liquidGroupPresetAnimation(params, preset),
      exit: liquidGroupPresetAnimation(params, preset)
    };
  });
};
