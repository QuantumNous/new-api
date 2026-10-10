import type { IGraphic, IGroup, INode } from '@visactor/vrender-core';
import type { ComponentExitReleasable } from '@visactor/vrender-components';

type ExitReleasableGraphic = IGraphic & ComponentExitReleasable;

type ReleaseVRenderComponentOptions = {
  enableExitAnimation?: boolean;
  removeFromParent?: boolean;
  onComplete?: () => void;
};

export const releaseVRenderComponentSync = (component: IGraphic, removeFromParent: boolean = true) => {
  const parent = component.parent;

  component.release?.(true);
  (component as unknown as IGroup).removeAllChild?.(true);

  if (removeFromParent) {
    (component.parent ?? parent)?.removeChild(component as unknown as INode, true);
  }
};

export const collectVRenderComponents = (component: IGraphic): IGraphic[] => {
  const components = [component];

  (component as unknown as IGroup).forEachChildren?.(child => {
    components.push(...collectVRenderComponents(child as IGraphic));
  });

  return components;
};

export const releaseVRenderComponent = (component: IGraphic, options: ReleaseVRenderComponentOptions = {}): boolean => {
  const { enableExitAnimation = true, removeFromParent = true, onComplete } = options;
  const releasedWithExit =
    enableExitAnimation &&
    (component as ExitReleasableGraphic).releaseWithExitAnimation?.({
      removeFromParent,
      onComplete
    });

  if (releasedWithExit) {
    return true;
  }

  releaseVRenderComponentSync(component, removeFromParent);
  return false;
};
