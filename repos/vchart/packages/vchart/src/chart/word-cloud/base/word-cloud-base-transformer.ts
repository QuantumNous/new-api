import { BaseChartSpecTransformer } from '../../base';
import type { IWordCloudChartSpec } from '../interface';

export class BaseWordCloudChartSpecTransformer<T extends IWordCloudChartSpec> extends BaseChartSpecTransformer<T> {
  transformSpec(spec: T): void {
    super.transformSpec(spec);
    this.transformSeriesSpec(spec);
  }

  protected _getDefaultSeriesSpec(spec: T): any {
    const series: any = super._getDefaultSeriesSpec(spec, [
      'nameField',
      'valueField',
      'fontFamilyField',
      'fontWeightField',
      'fontStyleField',
      'colorHexField',
      'colorMode',
      'colorList',
      'rotateAngles',
      'fontWeightRange',
      'fontSizeRange',
      'maskShape',
      'keepAspect',
      'random',
      'wordCloudConfig',
      'wordCloudShapeConfig',
      'word',
      'fillingWord',
      'wordMask'
    ]);

    return series;
  }
}
