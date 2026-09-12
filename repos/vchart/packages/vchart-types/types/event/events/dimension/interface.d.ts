import type { BaseEventParams } from '../../interface';
import type { ISeries } from '../../../series/interface';
import type { Datum } from '../../../typings';
import type { IAxis } from '../../../component/axis/interface';
export declare enum DimensionEventEnum {
    dimensionHover = "dimensionHover",
    dimensionClick = "dimensionClick"
}
export interface IDimensionInfo {
    index?: number;
    value: string | number;
    position?: number;
    axis?: IAxis;
    data: IDimensionData[];
    dimType?: string;
}
export interface IDimensionData {
    datum: Datum[];
    series: ISeries;
    key?: string;
}
export type DimensionEventParams = BaseEventParams & {
    action: 'enter' | 'leave' | 'move' | 'click';
    dimensionInfo: IDimensionInfo[];
};
