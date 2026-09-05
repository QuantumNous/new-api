import type { BaseEventParams } from '../../../event/interface';
import type { TooltipActiveType } from '../../../typings';
import type { GroupTooltipInfo, MouseEventData } from './interface';
import { BaseTooltipProcessor } from './base';
export declare class GroupTooltipProcessor extends BaseTooltipProcessor {
    activeType: TooltipActiveType;
    showTooltip(info: GroupTooltipInfo, params: BaseEventParams, changePositionOnly: boolean): import("../interface").TooltipResult;
    getMouseEventData(params: BaseEventParams): MouseEventData;
    protected _getGroupDatum(params: BaseEventParams): any;
}
export declare const registerGroupTooltipProcessor: () => void;
