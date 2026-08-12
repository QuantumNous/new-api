export { registerAnimate as registerVRenderAnimate, registerCustomAnimate } from '@visactor/vrender-animate';
export { registerStateTransition } from './state-transition';
export { registerSequentialAnimate } from './sequential-animate';
export { registerPolygonAnimation, registerRectAnimation, registerArcAnimation, registerScaleInOutAnimation, DEFAULT_ANIMATION_CONFIG } from './config';
export { animationConfig, userAnimationConfig, shouldMarkDoMorph } from './utils';
export type { IAnimationSpec } from './spec';
export type { IAnimationTypeConfig, IAnimationConfig, IAnimationParameters } from './interface';
