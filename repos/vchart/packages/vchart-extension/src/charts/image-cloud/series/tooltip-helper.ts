import type { Datum } from '@visactor/vchart';
import { BaseSeriesTooltipHelper } from '@visactor/vchart';
import type { ImageCloudSeries } from './image-cloud';

export class ImageCloudTooltipHelper extends BaseSeriesTooltipHelper {
  declare series: ImageCloudSeries<any>;
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
