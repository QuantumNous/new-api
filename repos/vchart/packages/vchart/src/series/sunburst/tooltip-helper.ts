import type { Datum } from '../../typings';
import { BaseSeriesTooltipHelper } from '../base/tooltip-helper';

export class SunburstTooltipHelper extends BaseSeriesTooltipHelper {
  markTooltipKeyCallback = (datum: Datum) => {
    return datum?.[this.series.getDimensionField()[0]];
  };
}
