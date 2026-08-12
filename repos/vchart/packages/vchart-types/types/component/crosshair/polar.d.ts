import type { IComponentOption } from '../interface';
import { ComponentTypeEnum } from '../interface/type';
import type { IPolarCrosshairSpec } from './interface';
import type { IPolarAxis } from '../axis/polar/interface';
import type { IPoint, StringOrNumber, TooltipActiveType, TooltipData } from '../../typings';
import { BaseCrossHair } from './base';
import type { Maybe } from '@visactor/vutils';
import type { IModelSpecInfo } from '../../model/interface';
import type { IAxis } from '../axis';
export declare class PolarCrossHair<T extends IPolarCrosshairSpec = IPolarCrosshairSpec> extends BaseCrossHair<T> {
    static specKey: string;
    static readonly builtInTheme: {
        crosshair: import("./interface").ICrosshairTheme;
    };
    static type: ComponentTypeEnum;
    type: ComponentTypeEnum;
    name: string;
    static getSpecInfo(chartSpec: any): Maybe<IModelSpecInfo[]>;
    constructor(spec: T, options: IComponentOption);
    setAxisValue(datum: StringOrNumber, axis: IAxis): void;
    private _findAllAxisContains;
    protected _getDatumAtPoint(axis: IPolarAxis, point: IPoint): any;
    protected _layoutCrosshair(relativeX: number, relativeY: number, tooltipData?: TooltipData, activeType?: TooltipActiveType): void;
    layoutByValue(enableRemain?: boolean): void;
    private _layoutByField;
}
export declare const registerPolarCrossHair: () => void;
