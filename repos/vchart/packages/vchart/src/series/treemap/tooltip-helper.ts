import type { Datum } from '../../typings';
import { BaseSeriesTooltipHelper } from '../base/tooltip-helper';
import type { TreemapSeries } from './treemap';

export class TreemapTooltipHelper extends BaseSeriesTooltipHelper {
  declare series: TreemapSeries;
  get defaultShapeType(): string {
    return 'square';
  }

  markTooltipKeyCallback = (datum: Datum) => {
    return this.series?.getMarkData(datum)?.[this.series.getDimensionField()[0]];
  };

  markTooltipValueCallback = (datum: Datum): string | undefined => {
    const { measureFields } = this._seriesCacheInfo;
    const data = this.series?.getMarkData(datum);
    if (measureFields[0] && data) {
      return data[measureFields[0]] ?? datum.value;
    }
    return undefined;
  };

  dimensionTooltipTitleCallback = (datum: Datum): string | undefined => {
    const { dimensionFields } = this._seriesCacheInfo;
    const data = this.series?.getMarkData(datum);
    if (dimensionFields[0] && data) {
      return data[dimensionFields[0]];
    }
    return undefined;
  };
}
