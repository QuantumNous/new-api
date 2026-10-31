import type { RenderMode } from '../../../typings/spec';
// eslint-disable-next-line no-duplicate-imports
import { RenderModeEnum } from '../../../typings/spec/common';
import { isMiniAppLikeMode, isMobileLikeMode } from '../../../util/env';
import { DeskTopTrigger } from './desktop';
import { MobileTrigger } from './mobile';

export function getDefaultTriggerEventByMode(mode: RenderMode) {
  if (mode === RenderModeEnum['desktop-browser'] || mode === RenderModeEnum['desktop-miniApp']) {
    return {
      start: 'pointerdown',
      move: 'pointermove',
      end: ['pointerup', 'pointerupoutside'],
      zoom: 'wheel',
      zoomEnd: 'pointerup',
      scroll: 'wheel',
      // scrollEnd: 'pointerup',
      trigger: DeskTopTrigger
    };
  }

  if (isMobileLikeMode(mode) || isMiniAppLikeMode(mode)) {
    return {
      start: 'pointerdown',
      move: 'pointermove',
      end: ['pointerup', 'pointerupoutside', 'pointerleave'],
      zoom: 'pinch',
      zoomEnd: 'pinchend',
      scroll: 'pan',
      scrollEnd: 'panend',
      trigger: MobileTrigger
    };
  }

  return null;
}
