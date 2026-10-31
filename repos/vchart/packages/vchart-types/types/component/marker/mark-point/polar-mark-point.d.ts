import { ComponentTypeEnum } from '../../interface/type';
import { BaseMarkPoint } from './base-mark-point';
import type { IMarkProcessOptions } from '../interface';
import type { CoordinateType } from '../../../typings';
export declare class PolarMarkPoint extends BaseMarkPoint {
    static type: ComponentTypeEnum;
    type: ComponentTypeEnum;
    name: string;
    static coordinateType: string;
    coordinateType: CoordinateType;
    static readonly builtInTheme: {
        polarMarkPoint: import("./interface").IMarkPointTheme<Partial<import("../interface").IMarkerSymbol>>;
    };
    protected _computePointsAttr(): {
        point: {
            x: number;
            y: number;
        };
    };
    protected _computeOptions(): IMarkProcessOptions;
}
export declare const registerPolarMarkPoint: () => void;
