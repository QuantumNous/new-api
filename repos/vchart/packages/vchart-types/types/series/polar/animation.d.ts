import type { EasingType } from '@visactor/vrender-core';
import type { IPointLike } from '@visactor/vutils';
import { ACustomAnimate, TagPointsUpdate } from '@visactor/vrender-animate';
export declare class PolarPointUpdate extends ACustomAnimate<{
    x: number;
    y: number;
}> {
    valid: boolean;
    private _fromAngle;
    private _fromRadius;
    private _toAngle;
    private _toRadius;
    private _center;
    private _prevCenter;
    constructor(from: {
        x: number;
        y: number;
        center: IPointLike;
    }, to: {
        x: number;
        y: number;
        center: IPointLike;
    }, duration: number, easing: EasingType, params: any);
    getEndProps(): Record<string, any>;
    onBind(): void;
    onUpdate(end: boolean, ratio: number, out: Record<string, any>): void;
}
export declare class PolarTagPointsUpdate extends TagPointsUpdate {
    private points;
    private interpolatePoints;
    private _center;
    private _prevCenter;
    onBind(): void;
    onUpdate(end: boolean, ratio: number, out: Record<string, any>): void;
    private _interpolationSinglePoint;
    private polarPointInterpolation;
}
