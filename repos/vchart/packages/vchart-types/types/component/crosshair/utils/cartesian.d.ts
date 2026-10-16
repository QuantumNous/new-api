import type { ICartesianSeries } from '../../../series';
import { type ILayoutPoint } from '../../../typings';
import type { CrossHairStateByField, CrossHairStateItem } from '../interface';
import type { IDimensionData } from '../../../event/events/dimension/interface';
export declare const layoutByValue: (stateByField: CrossHairStateByField, series: ICartesianSeries, layoutStartPoint: ILayoutPoint, enableRemain?: boolean) => CrossHairStateByField;
export declare const layoutCrosshair: (stateItem: CrossHairStateItem) => {
    visible: boolean;
    start: {
        [x: string]: number;
    };
    end: {
        [x: string]: number;
    };
};
export declare const getCartesianCrosshairRect: (dimensionData: IDimensionData, layoutStartPoint: ILayoutPoint) => {
    visible: boolean;
    start: {
        [x: string]: number;
    };
    end: {
        [x: string]: number;
    };
};
