import { AnimationTransitionRegistry } from '@visactor/vrender-animate';

export function registerStateTransition() {
  const animationTransitionRegistry = AnimationTransitionRegistry.getInstance();
  // update动画，可以被任何动画覆盖，但不会停止（disappear、exit除外）
  animationTransitionRegistry.registerTransition('update', '*', () => ({
    allowTransition: true,
    stopOriginalTransition: false
  }));
  // update动画碰到disappear动画，会停止，也会被覆盖
  animationTransitionRegistry.registerTransition('update', 'disappear', () => ({
    allowTransition: true,
    stopOriginalTransition: true
  }));
  // update动画碰到exit动画，会停止，也会被覆盖
  animationTransitionRegistry.registerTransition('update', 'exit', () => ({
    allowTransition: true,
    stopOriginalTransition: true
  }));

  // state动画，可以被任何动画覆盖，但不会停止（disappear、exit除外）
  animationTransitionRegistry.registerTransition('state', '*', () => ({
    allowTransition: true,
    stopOriginalTransition: false
  }));
  // state动画碰到disappear动画，会停止，也会被覆盖
  animationTransitionRegistry.registerTransition('state', 'disappear', () => ({
    allowTransition: true,
    stopOriginalTransition: true
  }));
  // state动画碰到exit动画，会停止，也会被覆盖
  animationTransitionRegistry.registerTransition('state', 'exit', () => ({
    allowTransition: true,
    stopOriginalTransition: true
  }));
}
