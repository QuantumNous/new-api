import type { ISeriesTooltipHelper } from '../interface';
import { BaseSeriesTooltipHelper } from '../base/tooltip-helper';
import type { Datum } from '../../typings';
import type { LiquidSeries } from './liquid';

export class LiquidSeriesTooltipHelper extends BaseSeriesTooltipHelper implements ISeriesTooltipHelper {
  markTooltipKeyCallback = (datum: any) => {
    return (this.series as LiquidSeries).getValueField();
  };

  markTooltipValueCallback = (datum: any) => {
    const valueField = (this.series as LiquidSeries).getValueField();
    return datum[valueField];
  };

  shapeStrokeCallback = (datum: Datum) => {
    return this.series.getMarkInName('liquid').getAttribute('fill', datum) as any;
  };
}
