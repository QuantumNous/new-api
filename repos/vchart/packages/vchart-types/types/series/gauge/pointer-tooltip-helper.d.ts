import type { ISeriesTooltipHelper } from '../interface';
import { BaseSeriesTooltipHelper } from '../base/tooltip-helper';
import type { TooltipActiveType } from '../../typings';
export declare class GaugePointerTooltipHelper extends BaseSeriesTooltipHelper implements ISeriesTooltipHelper {
    protected enableByType(activeType: TooltipActiveType): boolean;
}
