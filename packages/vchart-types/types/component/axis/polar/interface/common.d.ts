import type { IBaseScale } from '@visactor/vscale';
import type { IPoint, IPolarOrientType, IPolarPoint } from '../../../../typings';
import type { IAxis, IGrid } from '../../interface';
import type { ICompilableData } from '../../../../compile/data/interface';
export type IPolarGrid = IGrid & {
    smooth?: boolean;
};
export interface IPolarAxisHelper {
    isContinuous: boolean;
    dataToPosition: (values: any, cfg?: any) => number;
    coordToPoint: (point: IPolarPoint) => IPoint;
    pointToCoord: (point: IPoint) => IPolarPoint;
    center: () => IPoint;
    layoutRadius: () => number;
    getScale: (depth?: number) => IBaseScale;
    getBandwidth?: (depth?: number) => number;
    getAxisId: () => number;
    setExtendDomain?: (key: string, value: number | undefined) => void;
}
export interface IPolarAxis extends IAxis {
    startAngle: number;
    endAngle: number;
    getOrient: () => IPolarOrientType;
    getScale: () => IBaseScale;
    getCenter: () => IPoint;
    getOuterRadius: () => number;
    getInnerRadius: () => number;
    dataToPosition: (values: any[]) => number;
    positionToData: (position: IPoint) => any;
    getTickData: () => ICompilableData;
    coordToPoint: (point: IPolarPoint) => IPoint;
    pointToCoord: (point: IPoint) => IPolarPoint;
}
