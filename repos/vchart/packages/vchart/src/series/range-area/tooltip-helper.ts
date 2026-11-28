import type { ISeriesTooltipHelper } from '../interface';
import { BaseSeriesTooltipHelper } from '../base/tooltip-helper';
// eslint-disable-next-line no-duplicate-imports
import { Direction } from '../../typings/space';

export class RangeAreaSeriesTooltipHelper extends BaseSeriesTooltipHelper implements ISeriesTooltipHelper {
  protected _getMeasureData = (datum: any) => {
    return this.series.getSpec().direction === Direction.horizontal
      ? datum[this.series.getSpec().xField[0]] + '-' + datum[this.series.getSpec().xField[1]]
      : datum[this.series.getSpec().yField[0]] + '-' + datum[this.series.getSpec().yField[1]];
  };
}
