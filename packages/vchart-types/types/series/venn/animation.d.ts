import { ACustomAnimate } from '@visactor/vrender-animate';
import type { IVennCircle, IVennOverlapArc, VennCircleName } from '@visactor/vlayouts';
import type { VennAppearPreset } from './interface';
import type { IAnimationTypeConfig } from '../../animation/interface';
export declare const vennCirclePresetAnimation: (preset: VennAppearPreset) => IAnimationTypeConfig;
export declare const vennOverlapPresetAnimation: (preset: VennAppearPreset) => IAnimationTypeConfig;
export declare class VennOverlapAnimation extends ACustomAnimate<{
    path: string;
    arcs: IVennOverlapArc[];
}> {
    protected fromCircles: Record<VennCircleName, IVennCircle>;
    protected toCircles: Record<VennCircleName, IVennCircle>;
    onBind(): void;
    onUpdate(end: boolean, ratio: number, out: Record<string, any>): void;
}
export declare const registerVennAnimation: () => void;
