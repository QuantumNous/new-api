import type { IPolarSeries } from '../../../series';
import type { CrossHairStateByField, CrossHairStateItem } from '../interface';
import type { ILayoutPoint } from '../../../typings/layout';
export declare const layoutByValue: (stateByField: CrossHairStateByField, series: IPolarSeries, enableRemain?: boolean) => void;
export declare const layoutCrosshair: (stateItem: CrossHairStateItem, layoutStartPoint: ILayoutPoint, smooth?: boolean) => {
    center: {
        x: number;
        y: number;
    };
    innerRadius: number;
    radius: number;
    startAngle: number;
    endAngle: number;
    start?: undefined;
    end?: undefined;
    sides?: undefined;
} | {
    start: {
        x: number;
        y: number;
    };
    end: {
        x: number;
        y: number;
    };
    center?: undefined;
    innerRadius?: undefined;
    radius?: undefined;
    startAngle?: undefined;
    endAngle?: undefined;
    sides?: undefined;
} | {
    center: {
        x: number;
        y: number;
    };
    startAngle: number;
    endAngle: number;
    radius: number;
    sides: number;
    innerRadius?: undefined;
    start?: undefined;
    end?: undefined;
};
