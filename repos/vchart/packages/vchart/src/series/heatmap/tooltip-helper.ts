import type { TooltipActiveType } from '../../typings';
import { BaseSeriesTooltipHelper } from '../base/tooltip-helper';

export class HeatmapSeriesTooltipHelper extends BaseSeriesTooltipHelper {
  protected enableByType(activeType: TooltipActiveType): boolean {
    return activeType !== 'dimension';
  }
}
