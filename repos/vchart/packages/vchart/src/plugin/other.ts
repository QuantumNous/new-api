import { registerHtmlAttributePlugin, registerReactAttributePlugin } from '@visactor/vrender-core';

import { registerAnimate as registerVRenderAnimate } from '@visactor/vrender-animate/register';
import { DragNDrop, Gesture } from '@visactor/vrender-kits/event/extension';
import { Factory } from '../core/factory';
import { registerBuiltInAnimation, registerStageAnimation } from '../animation/config';

export const registerAnimate = () => {
  registerVRenderAnimate();
  registerBuiltInAnimation();
  registerStageAnimation();
};

export const registerDragPlugin = () => {
  Factory.registerStageEventPlugin('drag', DragNDrop);
};
export const registerGesturePlugin = () => {
  Factory.registerStageEventPlugin('gesture', Gesture);
};

export { registerReactAttributePlugin, registerHtmlAttributePlugin };
// export const registerMorph = registerViewMorphAPI;
