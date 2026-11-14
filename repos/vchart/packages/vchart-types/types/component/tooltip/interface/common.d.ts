import type { DimensionEventParams } from '../../../event/events/dimension/interface';
import type { DimensionTooltipInfo, GroupTooltipInfo, MarkTooltipInfo } from '../processor/interface';
import type { Datum, IShowTooltipOption, ITooltipActual, ITooltipHandler } from '../../../typings';
import type { IComponent } from '../../interface';
import type { ITooltipSpec } from './spec';
export type TooltipHandlerParams = DimensionEventParams & {
    changePositionOnly?: boolean;
    tooltip: ITooltip;
    tooltipSpec?: ITooltipSpec;
    activeTooltipSpec?: ITooltipActual;
    groupDatum?: Datum[];
};
export interface ITooltipActiveTypeAsKeys<T, K, U> {
    mark?: T;
    dimension?: K;
    group?: U;
}
export type TotalMouseEventData = {
    tooltipInfo: Partial<ITooltipActiveTypeAsKeys<MarkTooltipInfo, DimensionTooltipInfo, GroupTooltipInfo>>;
    ignore: Partial<ITooltipActiveTypeAsKeys<boolean, boolean, boolean>>;
};
export declare const enum TooltipResult {
    success = 0,
    failed = 1
}
export interface ITooltip extends IComponent {
    tooltipHandler?: ITooltipHandler;
    getVisible: () => boolean;
    showTooltip: (datum: Datum, options: IShowTooltipOption) => void;
    enable?: boolean;
}
