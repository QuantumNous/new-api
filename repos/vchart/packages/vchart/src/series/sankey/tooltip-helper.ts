import type { ISeriesTooltipHelper } from '../interface';
import { BaseSeriesTooltipHelper } from '../base/tooltip-helper';
import { isNil, isNumber } from '@visactor/vutils';
import type { Datum } from '../../typings/common';

export class SankeySeriesTooltipHelper extends BaseSeriesTooltipHelper implements ISeriesTooltipHelper {
  protected _getDimensionData = (datum: any) => {
    if (!isNil(datum?.source) && !isNil(datum?.target)) {
      if (isNumber(datum.source)) {
        const seriesKeys = this.series.getSeriesKeys();
        return seriesKeys[datum.source] + ' => ' + seriesKeys[datum.target];
      }
      return datum.source + ' => ' + datum.target;
    }
    return datum.datum ? datum.datum[this.series.getSpec().categoryField] : datum.key;
  };

  markTooltipValueCallback = (datum: Datum): string | undefined => {
    return datum.value;
  };
}
