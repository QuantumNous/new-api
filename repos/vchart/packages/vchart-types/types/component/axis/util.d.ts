import type { AxisType, ICommonAxisSpec, ILinearAxisSpec } from './interface';
import type { IAxisHelper } from './cartesian/interface/common';
import type { IPolarAxisHelper } from './polar/interface/common';
export declare const DEFAULT_TITLE_STYLE: {
    left: {
        textAlign: string;
        textBaseline: string;
    };
    right: {
        textAlign: string;
        textBaseline: string;
    };
    radius: {};
    angle: {};
};
export declare function transformAxisLineStyle(lineCfg: any): any;
export declare function getAxisLabelOffset(axisSpec: ICommonAxisSpec): number;
export declare function getLinearAxisSpecDomain(axisSpec: ILinearAxisSpec, defaultDomain?: {
    min?: number;
    max?: number;
}): {
    min: number;
    max: number;
};
export declare function isValidCartesianAxis(spec: any): boolean;
export declare function isValidPolarAxis(spec: any): boolean;
export declare const isDiscreteAxis: (axisType: AxisType) => boolean;
export declare function getAxisItem(value: any, normalizedValue: number): {
    id: any;
    label: any;
    value: number;
    rawValue: any;
};
export declare function shouldUpdateAxis(preHelper: IAxisHelper | IPolarAxisHelper, curHelper: IAxisHelper | IPolarAxisHelper, forceUpdate: boolean): boolean;
