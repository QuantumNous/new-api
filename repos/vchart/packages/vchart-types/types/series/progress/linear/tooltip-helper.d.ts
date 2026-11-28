import { BaseSeriesTooltipHelper } from '../../base/tooltip-helper';
import type { ISeriesTooltipHelper } from '../../interface';
import type { TooltipActiveType } from '../../../typings';
export declare class LinearProgressSeriesTooltipHelper extends BaseSeriesTooltipHelper implements ISeriesTooltipHelper {
    protected enableByType(activeType: TooltipActiveType): boolean;
}
