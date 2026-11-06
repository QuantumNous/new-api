import type { IFunnelSeries, ISeriesTooltipHelper } from '../interface';
import { BaseSeriesTooltipHelper } from '../base/tooltip-helper';
import type { TooltipHandlerParams } from '../../component/tooltip/interface';
import type { Datum } from '../../typings/common';
export declare class FunnelSeriesTooltipHelper extends BaseSeriesTooltipHelper implements ISeriesTooltipHelper {
    private _transformRatioText;
    constructor(series: IFunnelSeries);
    dimensionTooltipTitleCallback: (datum: Datum, params?: TooltipHandlerParams) => any;
    markTooltipValueCallback: (datum: Datum, params?: TooltipHandlerParams) => any;
    markTooltipKeyCallback: (datum: Datum, params?: TooltipHandlerParams) => any;
}
