import { ComponentTypeEnum } from '../../interface/type';
import type { CoordinateType, IPoint } from '../../../typings';
import { BaseMarkPoint } from './base-mark-point';
import type { IMarkProcessOptions } from '../interface';
export declare class CartesianMarkPoint extends BaseMarkPoint {
    static type: ComponentTypeEnum;
    type: ComponentTypeEnum;
    name: string;
    static coordinateType: string;
    coordinateType: CoordinateType;
    static readonly builtInTheme: {
        markPoint: import("./interface").IMarkPointTheme<Partial<import("../interface").IMarkerSymbol>>;
    };
    protected _computePointsAttr(): {
        point: IPoint;
    };
    protected _computeOptions(): IMarkProcessOptions;
}
export declare const registerMarkPoint: () => void;
