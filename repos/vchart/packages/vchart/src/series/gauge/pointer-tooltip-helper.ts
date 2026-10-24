import type { ISeriesTooltipHelper } from '../interface';
import { BaseSeriesTooltipHelper } from '../base/tooltip-helper';
import type { TooltipActiveType } from '../../typings';

export class GaugePointerTooltipHelper extends BaseSeriesTooltipHelper implements ISeriesTooltipHelper {
  protected enableByType(activeType: TooltipActiveType): boolean {
    return activeType !== 'dimension';
  }
}
