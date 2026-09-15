import { type Datum, type IPoint, type IShowTooltipOption, type TooltipActiveType } from '../../../typings';
import type { ISeries } from '../../../series/interface';
import type { IRegion } from '../../../region';
import type { Tooltip } from '../tooltip';
type MarkInfo = {
    pos: IPoint;
    data: {
        dimensionFields: string[];
        measureFields: string[];
        dimensionData?: any[];
        measureData?: any[];
        hasMeasureData?: boolean;
        groupField?: string;
        groupData?: any;
        originDatum?: Datum;
    };
    series: ISeries;
    dimType?: string;
};
export declare function showTooltip(datum: Datum, options: IShowTooltipOption, component: Tooltip): TooltipActiveType | 'none';
export declare const getMarkInfoList: (datum: Datum, region: IRegion) => MarkInfo[];
export {};
