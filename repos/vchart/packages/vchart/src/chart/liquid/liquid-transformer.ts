import { SeriesTypeEnum } from '../../series';
import { BaseChartSpecTransformer } from '../base';
import type { ILiquidChartSpec } from './interface';

export class LiquidChartSpecTransformer<
  T extends ILiquidChartSpec = ILiquidChartSpec
> extends BaseChartSpecTransformer<T> {
  protected _getDefaultSeriesSpec(spec: T): any {
    const series: any = super._getDefaultSeriesSpec(spec, [
      'valueField',
      'maskShape',
      'reverse',
      'outlineMargin',
      'outlinePadding',
      'indicatorSmartInvert',
      'liquidBackground',
      'liquidOutline'
    ]);

    return series;
  }

  transformSpec(spec: T): void {
    super.transformSpec(spec);
    this.transformSeriesSpec(spec);
  }
}
