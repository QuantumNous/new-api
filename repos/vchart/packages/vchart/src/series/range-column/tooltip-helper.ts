import type { ISeriesTooltipHelper } from '../interface';
import { BaseSeriesTooltipHelper } from '../base/tooltip-helper';
import { Direction } from '../../typings/space';

export class RangeColumnSeriesTooltipHelper extends BaseSeriesTooltipHelper implements ISeriesTooltipHelper {
  protected _getMeasureData = (datum: any) => {
    return this.series.getSpec().direction === Direction.horizontal
      ? datum[this.series.getSpec().xField[0]] + '-' + datum[this.series.getSpec().xField[1]]
      : datum[this.series.getSpec().yField[0]] + '-' + datum[this.series.getSpec().yField[1]];
  };
}
