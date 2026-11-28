import { ComponentTypeEnum } from '../../interface/type';
import { BaseMarkPoint } from './base-mark-point';
import type { CoordinateType } from '../../../typings';
export declare class GeoMarkPoint extends BaseMarkPoint {
    static type: ComponentTypeEnum;
    type: ComponentTypeEnum;
    name: string;
    static coordinateType: string;
    coordinateType: CoordinateType;
    static readonly builtInTheme: {
        geoMarkPoint: import("./interface").IMarkPointTheme<Partial<import("../interface").IMarkerSymbol>>;
    };
    protected _computePointsAttr(): {
        point: import("../../../typings").IPoint;
    };
    protected _computeOptions(): any;
}
export declare const registerGeoMarkPoint: () => void;
