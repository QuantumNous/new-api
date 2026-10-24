import type { IMarkGraphic } from '../mark/interface';

const normalizeStates = (states?: string | string[]) => (Array.isArray(states) ? states : states ? [states] : []);

type SetStatesOptions = {
  animate?: boolean;
  animateSameStatePatchChange?: boolean;
};

type GraphicWithSetStatesOptions = IMarkGraphic & {
  setStates: (states?: string[] | null, options?: boolean | SetStatesOptions) => void;
};

const isSameStates = (currentStates: readonly string[] | undefined, nextStates: readonly string[]) => {
  const current = currentStates ?? [];
  if (current.length !== nextStates.length) {
    return false;
  }

  return current.every((stateName, index) => stateName === nextStates[index]);
};

export const setGraphicStates = (graphic: IMarkGraphic, nextStates?: string[] | null, hasAnimation?: boolean) => {
  if (graphic.setStates) {
    (graphic as GraphicWithSetStatesOptions).setStates(nextStates, {
      animate: hasAnimation,
      animateSameStatePatchChange: true
    });
    return;
  }

  const normalizedNextStates = nextStates ?? [];
  if (isSameStates(graphic.currentStates, normalizedNextStates)) {
    graphic.invalidateResolver?.();
    return;
  }

  if (normalizedNextStates.length) {
    graphic.useStates(normalizedNextStates, hasAnimation);
  } else {
    graphic.clearStates(hasAnimation);
  }
};

export const addGraphicState = (
  graphic: IMarkGraphic,
  state: string,
  keepCurrentStates: boolean = true,
  hasAnimation?: boolean
) => {
  if (!state) {
    return;
  }

  const currentStates = keepCurrentStates ? graphic.currentStates ?? [] : [];
  const nextStates = keepCurrentStates ? Array.from(new Set([...currentStates, state])) : [state];

  setGraphicStates(graphic, nextStates, hasAnimation);
};

export const removeGraphicState = (graphic: IMarkGraphic, state: string | string[], hasAnimation?: boolean) => {
  const states = normalizeStates(state);

  if (!states.length) {
    return;
  }

  const currentStates = (graphic.currentStates ?? []) as string[];
  const nextStates = currentStates.filter((stateName: string) => !states.includes(stateName));

  setGraphicStates(graphic, nextStates, hasAnimation);
};
