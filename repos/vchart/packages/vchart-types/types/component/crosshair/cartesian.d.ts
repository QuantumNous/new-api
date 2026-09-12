import type { Maybe } from '@visactor/vutils';
import type { IComponentOption } from '../interface';
import { ComponentTypeEnum } from '../interface/type';
import type { ICartesianCrosshairSpec } from './interface';
import { BaseCrossHair } from './base';
import type { IAxis } from '../axis/interface';
import type { IPoint, StringOrNumber, TooltipActiveType, TooltipData } from '../../typings';
import type { IModelSpecInfo } from '../../model/interface';
export declare class CartesianCrossHair<T extends ICartesianCrosshairSpec = ICartesianCrosshairSpec> extends BaseCrossHair<T> {
    static specKey: string;
    static readonly builtInTheme: {
        crosshair: import("./interface").ICrosshairTheme;
    };
    static type: ComponentTypeEnum;
    type: ComponentTypeEnum;
    name: string;
    static getSpecInfo(chartSpec: any): Maybe<IModelSpecInfo[]>;
    constructor(spec: T, options: IComponentOption);
    private _findAllAxisContains;
    protected _getDatumAtPoint(axis: IAxis, point: IPoint): number | string;
    setAxisValue(datum: StringOrNumber, axis: IAxis): void;
    protected _layoutCrosshair(relativeX: number, relativeY: number, tooltipData?: TooltipData, activeType?: TooltipActiveType): void;
    layoutByValue(enableRemain?: boolean): void;
    private _layoutByField;
    private _updateCrosshairByField;
}
export declare const registerCartesianCrossHair: () => void;
