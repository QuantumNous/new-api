import type { IMarkGraphic } from '../interface/common';
import { addGraphicState, removeGraphicState } from '../../util/graphic-state';

export const addRuntimeState = (
  g: IMarkGraphic,
  stateName: string,
  attrs: any,
  keepCurrentStates: boolean = true,
  hasAnimation?: boolean
) => {
  if (!g.runtimeStateCache) {
    g.runtimeStateCache = {};
  }

  g.runtimeStateCache[stateName] = attrs;

  if (g.hasState(stateName)) {
    removeGraphicState(g, stateName);
  }
  addGraphicState(g, stateName, keepCurrentStates, hasAnimation);
};
