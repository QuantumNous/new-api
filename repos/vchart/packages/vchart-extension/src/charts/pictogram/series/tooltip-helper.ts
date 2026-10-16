import type { Datum, ISeriesTooltipHelper, TooltipHandlerParams } from '@visactor/vchart';
import { BaseSeriesTooltipHelper } from '@visactor/vchart';
import type { PictogramSeries } from './pictogram';

export class PictogramSeriesTooltipHelper extends BaseSeriesTooltipHelper implements ISeriesTooltipHelper {
  dimensionTooltipTitleCallback = (datum: any) => {
    const series = this.series as PictogramSeries;
    return this._getDimensionData(datum) ?? series.getDatumName(datum);
  };

  markTooltipValueCallback = (datum: Datum, params?: TooltipHandlerParams) => {
    const { measureFields } = this._seriesCacheInfo;
    if (measureFields[0] && datum.data) {
      return datum.data[measureFields[0]];
    }
  };

  markTooltipKeyCallback = (datum: Datum) => {
    return datum.data?.[this.series.getDimensionField()[0]];
  };
}
