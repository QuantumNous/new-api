import type { ISeriesTooltipHelper } from '../interface';
import { BaseSeriesTooltipHelper } from '../base/tooltip-helper';
import type { Datum } from '../../typings';
export declare class LiquidSeriesTooltipHelper extends BaseSeriesTooltipHelper implements ISeriesTooltipHelper {
    markTooltipKeyCallback: (datum: any) => string;
    markTooltipValueCallback: (datum: any) => any;
    shapeStrokeCallback: (datum: Datum) => any;
}
