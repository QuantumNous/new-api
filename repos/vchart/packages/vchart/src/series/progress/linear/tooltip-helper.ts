import { BaseSeriesTooltipHelper } from '../../base/tooltip-helper';
import type { ISeriesTooltipHelper } from '../../interface';
import type { TooltipActiveType } from '../../../typings';

export class LinearProgressSeriesTooltipHelper extends BaseSeriesTooltipHelper implements ISeriesTooltipHelper {
  /** 获取默认的tooltip pattern */
  protected enableByType(activeType: TooltipActiveType): boolean {
    return activeType !== 'dimension';
  }
}
