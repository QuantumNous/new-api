import type { ISeriesTooltipHelper } from '../interface';
import { BaseSeriesTooltipHelper } from '../base/tooltip-helper';
export declare class RangeAreaSeriesTooltipHelper extends BaseSeriesTooltipHelper implements ISeriesTooltipHelper {
    protected _getMeasureData: (datum: any) => string;
}
