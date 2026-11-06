import type { AdaptiveSpec } from '../../../typings';
import { PolarChartSpecTransformer } from '../../polar';
import type { IPieChartSpec } from '../interface';

export class BasePieChartSpecTransformer<T extends IPieChartSpec> extends PolarChartSpecTransformer<
  AdaptiveSpec<T, 'axes'>
> {
  protected needAxes(): boolean {
    return false;
  }

  protected _getDefaultSeriesSpec(spec: any): any {
    const seriesSpec = super._getDefaultSeriesSpec(spec, [
      'center',
      'centerOffset',
      'cornerRadius',
      'padAngle',
      'minAngle',
      'emptyPlaceholder',
      'showAllZero',
      'supportNegative',
      'useSequentialAnimation',
      'layoutRadius'
    ]);
    this._addSeriesRelatedSpecKeys(['valueField', 'angleField']);
    // 兼容旧版写法
    seriesSpec.categoryField = spec.categoryField || spec.seriesField;
    seriesSpec.valueField = spec.valueField || spec.angleField;
    seriesSpec.emptyCircle = spec.emptyPlaceholder?.emptyCircle;
    return seriesSpec;
  }
}
