import { AStageAnimate } from '@visactor/vrender-animate/custom/custom-animate';
import type { EasingType } from '@visactor/vrender-core';

/**
 * 特效动画基类，提取公共的WebGL和Canvas 2D操作
 */
export class CallbackDisappearAnimate extends AStageAnimate<any> {
  protected currentAnimationRatio = 0;
  protected animationTime = 0;

  constructor(from: null, to: null, duration: number, easing: EasingType, params: any) {
    super(from, to, duration, easing, params);
  }

  onUpdate(end: boolean, ratio: number, out: any): void {
    super.onUpdate(end, ratio, out);
    this.currentAnimationRatio = ratio;
    this.animationTime = ratio * Math.PI * 2;
  }

  /**
   * 获取基于动画进度的时间
   */
  protected getAnimationTime(): number {
    if (this.currentAnimationRatio > 0) {
      return this.animationTime;
    }
    return Date.now() / 1000.0;
  }

  protected afterStageRender(stage: any, canvas: HTMLCanvasElement): void {
    return this.params?.callBack?.(stage, canvas, this.currentAnimationRatio, this.animationTime);
  }
}
