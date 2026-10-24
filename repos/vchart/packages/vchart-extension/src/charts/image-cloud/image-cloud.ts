import type { IImageCloudChartSpec } from './interface';

import { ImageCloudChartSpecTransformer } from './image-cloud-transformer';
import { BaseChart, Factory } from '@visactor/vchart';
import { registerImageCloudSeries } from './series/image-cloud';
import { IMAGE_CLOUD_CHART_TYPE, IMAGE_CLOUD_SERIES_TYPE } from './series/constant';

export class ImageCloudChart<T extends IImageCloudChartSpec = IImageCloudChartSpec> extends BaseChart<T> {
  static readonly type: string = IMAGE_CLOUD_CHART_TYPE;
  static readonly seriesType: string = IMAGE_CLOUD_SERIES_TYPE;
  static readonly transformerConstructor = ImageCloudChartSpecTransformer;
  readonly transformerConstructor = ImageCloudChart.transformerConstructor;
  readonly type: string = IMAGE_CLOUD_CHART_TYPE;
  readonly seriesType: string = IMAGE_CLOUD_SERIES_TYPE;
}

export const registerImageCloudChart = () => {
  registerImageCloudSeries();
  Factory.registerChart(ImageCloudChart.type, ImageCloudChart);
};
