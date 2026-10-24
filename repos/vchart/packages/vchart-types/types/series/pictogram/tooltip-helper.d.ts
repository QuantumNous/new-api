import type { ISeriesTooltipHelper } from '../interface';
import { BaseSeriesTooltipHelper } from '../base/tooltip-helper';
import type { TooltipHandlerParams } from '../../component';
import type { Datum } from '../../typings';
export declare class PictogramSeriesTooltipHelper extends BaseSeriesTooltipHelper implements ISeriesTooltipHelper {
    dimensionTooltipTitleCallback: (datum: any) => any;
    markTooltipValueCallback: (datum: Datum, params?: TooltipHandlerParams) => any;
    markTooltipKeyCallback: (datum: Datum) => any;
}
