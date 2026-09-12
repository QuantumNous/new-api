import { isValid, radianToDegree } from '@visactor/vutils';
import { BaseChartSpecTransformer } from '../base';
import type { ISunburstChartSpec } from './interface';
import { POLAR_START_ANGLE } from '../../constant/polar';
import type { ISunburstSeriesSpec } from '../../series';
// eslint-disable-next-line no-duplicate-imports
import { SeriesTypeEnum } from '../../series';

export class SunburstChartSpecTransformer<
  T extends ISunburstChartSpec = ISunburstChartSpec
> extends BaseChartSpecTransformer<T> {
  protected _getDefaultSeriesSpec(spec: T) {
    // 开始角度默认使用用户配置
    const startAngle = isValid(spec.startAngle) ? spec.startAngle : POLAR_START_ANGLE;
    // 结束角度默认使用用户的配置, 若用户没配置, 默认补成整圆.
    const endAngle = isValid(spec.endAngle) ? spec.endAngle : startAngle + radianToDegree(Math.PI * 2);

    const series: ISunburstSeriesSpec = super._getDefaultSeriesSpec(spec, [
      'categoryField',
      'valueField',
      'centerX',
      'centerY',
      'offsetX',
      'offsetY',
      'innerRadius',
      'outerRadius',
      'gap',
      'labelLayout',
      'label',
      'labelAutoVisible',
      'drill',
      'drillField'
    ]);

    series.startAngle = startAngle;
    series.endAngle = endAngle;

    return series;
  }

  transformSpec(spec: T): void {
    super.transformSpec(spec);
    this.transformSeriesSpec(spec);
  }
}
