import type { IFunnelSeriesSpec } from '../../series';
import type { ISeriesSpec } from '../../typings';
import { BaseChartSpecTransformer } from '../base';
import type { IFunnelChartSpec } from './interface';

export class FunnelChartSpecTransformer<T extends IFunnelChartSpec> extends BaseChartSpecTransformer<T> {
  protected needAxes(): boolean {
    return false;
  }

  protected _getDefaultSeriesSpec(spec: T): IFunnelSeriesSpec {
    const series: any = super._getDefaultSeriesSpec(spec, [
      'categoryField',
      'valueField',
      'funnelAlign',
      'funnelOrient',
      'heightRatio',
      'shape',
      'funnel',
      'transform',
      'outerLabel',
      'transformLabel',
      'isTransform',
      'maxSize',
      'minSize',
      'gap',
      'isCone',
      'range',
      'transformRatioText'
    ]);

    return series;
  }
  transformSpec(spec: T): void {
    super.transformSpec(spec);
    super.transformSeriesSpec(spec);
  }
}
