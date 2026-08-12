import type { EasingType } from '@visactor/vrender-core';
import { ACustomAnimate } from '@visactor/vrender-animate';
export interface IBoxplotScaleAnimationOptions {
    center?: number;
}
export declare class BoxplotScaleIn extends ACustomAnimate<Record<string, number>> {
    constructor(from: null, to: null, duration: number, easing: EasingType, params?: IBoxplotScaleAnimationOptions);
    onBind(): void;
    computeAttribute(): {
        from?: {
            [channel: string]: any;
        };
        to?: {
            [channel: string]: any;
        };
    };
    onUpdate(end: boolean, ratio: number, out: Record<string, any>): void;
}
export declare class BoxplotScaleOut extends ACustomAnimate<Record<string, number>> {
    constructor(from: null, to: null, duration: number, easing: EasingType, params?: IBoxplotScaleAnimationOptions);
    onBind(): void;
    computeAttribute(): {
        from?: {
            [channel: string]: any;
        };
        to?: {
            [channel: string]: any;
        };
    };
    onUpdate(end: boolean, ratio: number, out: Record<string, any>): void;
}
export declare class BarBoxplotScaleIn extends BoxplotScaleIn {
    computeAttribute(): {
        from?: {
            [channel: string]: any;
        };
        to?: {
            [channel: string]: any;
        };
    };
}
export declare class BarBoxplotScaleOut extends BoxplotScaleOut {
    computeAttribute(): {
        from?: {
            [channel: string]: any;
        };
        to?: {
            [channel: string]: any;
        };
    };
}
export declare const registeBoxPlotScaleAnimation: () => void;
