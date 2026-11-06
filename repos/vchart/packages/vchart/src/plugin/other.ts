import { DragNDrop, Gesture } from '@visactor/vrender-kits/event/extension';
import { Factory } from '../core/factory';
import { registerBuiltInAnimation, registerStageAnimation } from '../animation/config';
import { registerHtmlAttributePlugin, registerReactAttributePlugin, registerVRenderAnimate } from '../vrender-bridge';

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
