import type { IPolarAxisCommonSpec } from '../interface';
import type { ILayoutRect } from '../../../../typings/layout';
import type { IPoint } from '../../../../typings/coordinate';
import type { IPolarOrientType } from '../../../../typings/space';
import type { AxisType } from '../../interface/common';
export declare const getPolarAxisInfo: (spec: IPolarAxisCommonSpec, chartSpec: any) => {
    axisType: AxisType;
    componentName: string;
    startAngle: any;
    endAngle: any;
    center: any;
    outerRadius: any;
    layoutRadius: any;
};
export declare const computeLayoutRadius: (getLayoutRadius: () => number | "auto" | ((layoutRect: ILayoutRect, center: IPoint) => number), getLayoutRect: () => ILayoutRect, getCenter: () => IPoint, getAngles: () => {
    startAngle: number;
    endAngle: number;
}) => number;
export declare const getPolarAxisTheme: (orient: IPolarOrientType, type: AxisType, getTheme: (...keys: string[]) => any) => any;
