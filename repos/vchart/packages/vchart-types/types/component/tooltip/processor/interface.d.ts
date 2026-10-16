import type { IMark } from '../../../mark/interface';
import type { ISeries } from '../../../series/interface';
import type { IDimensionInfo } from '../../../event/events/dimension/interface';
import type { Datum } from '../../../typings/common';
import type { BaseEventParams } from '../../../event/interface';
import type { ITooltip, TooltipResult } from '../interface/common';
export type DimensionTooltipInfo = IDimensionInfo[];
export type MarkTooltipInfo<T = Datum> = {
    datum: T;
    mark: IMark;
    series: ISeries;
};
export type GroupTooltipInfo = MarkTooltipInfo<Datum | Datum[]>;
export type TooltipInfo = DimensionTooltipInfo | MarkTooltipInfo | GroupTooltipInfo;
export type MouseEventData = {
    tooltipInfo: TooltipInfo;
    ignore: boolean;
};
export interface ITooltipProcessor<T> {
    shouldHandleTooltip: (params: BaseEventParams, info: TooltipInfo) => boolean;
    clearCache: () => void;
    showTooltip: (info: T, params: BaseEventParams, changePositionOnly: boolean) => TooltipResult;
    getMouseEventData: (params: BaseEventParams) => MouseEventData;
}
export interface ITooltipProcessorConstructor {
    new (comp: ITooltip): ITooltipProcessor<DimensionTooltipInfo> | ITooltipProcessor<MarkTooltipInfo> | ITooltipProcessor<GroupTooltipInfo>;
}
