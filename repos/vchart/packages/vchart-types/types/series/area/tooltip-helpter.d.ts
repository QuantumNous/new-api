import type { ISeriesTooltipHelper } from '../interface';
import { BaseSeriesTooltipHelper } from '../base/tooltip-helper';
export declare class AreaSeriesTooltipHelper extends BaseSeriesTooltipHelper implements ISeriesTooltipHelper {
    protected _getSeriesStyle: (datum: any, styleKey: string | string[], defaultValue?: any) => any;
}
