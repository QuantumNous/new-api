import type { ISeriesTooltipHelper } from '../interface';
import { BaseSeriesTooltipHelper } from '../base/tooltip-helper';
import { array, isValid } from '@visactor/vutils';

export class AreaSeriesTooltipHelper extends BaseSeriesTooltipHelper implements ISeriesTooltipHelper {
  protected _getSeriesStyle = (datum: any, styleKey: string | string[], defaultValue?: any) => {
    for (const key of array(styleKey)) {
      let value = this.series.getSeriesStyle(datum)?.(key);
      // because of line mark merge into area mark
      // TODO: if tooltip symbol use mark fill & stroke ,remove this code
      if (value === false && (key === 'fill' || key === 'stroke')) {
        if (key === 'fill') {
          value = this.series.getSeriesStyle(datum)?.('stroke')?.[0];
        } else {
          value = this.series.getSeriesStyle(datum)?.('fill');
        }
      }
      if (isValid(value)) {
        return value;
      }
    }
    return defaultValue;
  };
}
