import { BaseChartSpecTransformer } from '@visactor/vchart';
import type { IImageCloudChartSpec } from './interface';

export class ImageCloudChartSpecTransformer<T extends IImageCloudChartSpec> extends BaseChartSpecTransformer<T> {
  transformSpec(spec: T): void {
    super.transformSpec(spec);
    this.transformSeriesSpec(spec);
  }

  protected _getDefaultSeriesSpec(spec: T): T {
    const series: T = super._getDefaultSeriesSpec(spec, [
      'urlField',
      'nameField',
      'valueField',
      'imageSize',
      'imageSizeRange',
      'ratio',
      'maskShape',
      'imageMask',
      'layoutConfig',
      'image'
    ]);

    return series;
  }
}
