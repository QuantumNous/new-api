import { AStageAnimate } from '@visactor/vrender-animate/custom/custom-animate';
import { EasingType } from '@visactor/vrender-core';
export declare class CallbackDisappearAnimate extends AStageAnimate<any> {
    protected currentAnimationRatio: number;
    protected animationTime: number;
    constructor(from: null, to: null, duration: number, easing: EasingType, params: any);
    onUpdate(end: boolean, ratio: number, out: any): void;
    protected getAnimationTime(): number;
    protected afterStageRender(stage: any, canvas: HTMLCanvasElement): void;
}
