import { getContainerSize, isString } from '@visactor/vutils';
import type { IChartSpec } from '../typings';
// eslint-disable-next-line no-duplicate-imports
import { Direction } from '../typings';
import { array, isMiniAppLikeMode, isTrueBrowser, isValid } from '../util';
import { mergeSpec } from '@visactor/vutils-extension';
import type { ICartesianChartSpec } from './cartesian/interface';
import type { IChartOption } from './interface/common';
import type { IUpdateSpecEffects, IUpdateSpecResult } from '../model/interface';
import { vglobal } from '@visactor/vrender-core';

export function setDefaultCrosshairForCartesianChart(spec: ICartesianChartSpec) {
  spec.crosshair = array(spec.crosshair || {}).map(crosshairCfg => {
    return mergeSpec(
      {
        [spec.direction === Direction.horizontal ? 'yField' : 'xField']: {
          visible: true,
          line: {
            visible: true,
            type: 'rect'
          }
        }
      },
      crosshairCfg
    );
  });
}

export function calculateChartSize(
  spec: { width?: number; height?: number },
  option: Pick<IChartOption, 'canvas' | 'container' | 'mode' | 'modeParams'>,
  defaultSize: { width: number; height: number }
) {
  const { width: userWidth, height: userHeight } = spec;
  if (isValid(userWidth) && isValid(userHeight)) {
    return {
      width: userWidth,
      height: userHeight
    };
  }
  let width = defaultSize.width;
  let height = defaultSize.height;
  const container = option.container;
  const canvas = option.canvas;
  if (container) {
    const { width: containerWidth, height: containerHeight } = getContainerSize(
      container,
      defaultSize.width,
      defaultSize.height
    );
    width = containerWidth;
    height = containerHeight;
  } else if (canvas && isTrueBrowser(option.mode)) {
    let canvasNode;
    if (isString(canvas)) {
      canvasNode = vglobal.getElementById(canvas);
    } else {
      canvasNode = canvas;
    }
    const { width: containerWidth, height: containerHeight } = getContainerSize(
      canvasNode as HTMLCanvasElement,
      defaultSize.width,
      defaultSize.height
    );
    width = containerWidth;
    height = containerHeight;
  } else if (isMiniAppLikeMode(option.mode) && (option.modeParams as any)?.domref) {
    const domRef = (option.modeParams as any).domref;
    width = domRef.width;
    height = domRef.height;
  }

  width = userWidth ?? width;
  height = userHeight ?? height;

  return {
    width,
    height
  };
}

const UPDATE_SPEC_EFFECT_KEYS: (keyof IUpdateSpecEffects)[] = [
  'remake',
  'compile',
  'render',
  'layout',
  'data',
  'scaleDomain',
  'series',
  'component',
  'animation',
  'localOnly'
];

function mergeUpdateSpecEffects(target: IUpdateSpecResult, ...sources: IUpdateSpecResult[]) {
  sources.forEach(source => {
    const sourceEffects = source?.effects;

    if (!sourceEffects) {
      return;
    }
    if (!target.effects) {
      target.effects = {};
    }
    const targetEffects = target.effects;

    UPDATE_SPEC_EFFECT_KEYS.forEach(key => {
      if (sourceEffects[key]) {
        targetEffects[key] = targetEffects[key] || sourceEffects[key];
      }
    });
  });
}

export function normalizeUpdateSpecEffects(result: IUpdateSpecResult): IUpdateSpecEffects {
  const effects = result.effects ?? (result.effects = {});

  if (result.reMake) {
    effects.remake = true;
    effects.compile = true;
    effects.data = true;
    effects.scaleDomain = true;
    effects.layout = true;
    effects.render = true;
  }
  if (result.reCompile) {
    effects.compile = true;
    effects.layout = true;
    effects.render = true;
  }
  if (result.reRender) {
    effects.render = true;
  }
  if (result.reSize) {
    effects.layout = true;
    effects.render = true;
  }

  return effects;
}

export function isUpdateSpecResultLocalOnly(result: IUpdateSpecResult): boolean {
  const effects = result.effects;

  return (
    !!effects?.localOnly &&
    !result.reMake &&
    !result.reCompile &&
    !result.reRender &&
    !result.reSize &&
    !effects.remake &&
    !effects.compile &&
    !effects.render &&
    !effects.layout &&
    !effects.data &&
    !effects.scaleDomain &&
    !effects.series &&
    !result.reTransformSpec &&
    !result.reAnimate &&
    !result.changeTheme &&
    !result.changeBackground
  );
}

export function isUpdateSpecResultComponentOnly(result: IUpdateSpecResult): boolean {
  const effects = result.effects;

  return (
    !!effects?.component &&
    !result.reMake &&
    !result.reCompile &&
    !result.reSize &&
    !effects.remake &&
    !effects.compile &&
    !effects.data &&
    !effects.scaleDomain &&
    !effects.series &&
    !effects.animation &&
    !result.reTransformSpec &&
    !result.reAnimate &&
    !result.changeTheme &&
    !result.changeBackground
  );
}

export function mergeUpdateResult(target: IUpdateSpecResult, ...sources: IUpdateSpecResult[]) {
  type UpdateSpecResultFlag = Exclude<keyof IUpdateSpecResult, 'effects'>;
  const merge = (key: UpdateSpecResultFlag) => sources.reduce((value, cur) => value || cur?.[key], target[key]);

  Object.assign(target, {
    change: merge('change'),
    reCompile: merge('reCompile'),
    reMake: merge('reMake'),
    reRender: merge('reRender'),
    reSize: merge('reSize'),
    reTransformSpec: merge('reTransformSpec'),
    changeTheme: merge('changeTheme'),
    changeBackground: merge('changeBackground')
  } as Required<IUpdateSpecResult>);
  mergeUpdateSpecEffects(target, ...sources);
  return target;
}

export function getTrimPaddingConfig(chartType: string, spec: IChartSpec) {
  if (
    chartType === 'line' ||
    chartType === 'area' ||
    (chartType === 'common' && spec.series.every(item => item.type === 'area' || item.type === 'line'))
  ) {
    return {
      paddingInner: 1,
      paddingOuter: 0
    };
  }

  return {
    paddingOuter: 0
  };
}
