import type { ICartesianAxisSpec } from '../../component/axis/cartesian/interface/spec';
import { CartesianChartSpecTransformer } from '../cartesian';
import { setDefaultCrosshairForCartesianChart } from '../util';
import type { IMosaicChartSpec } from './interface';

export class MosaicChartSpecTransformer<
  T extends IMosaicChartSpec = IMosaicChartSpec
> extends CartesianChartSpecTransformer<T> {
  protected _getDefaultSeriesSpec(spec: T): any {
    return super._getDefaultSeriesSpec(spec, [
      'barWidth',
      'barMaxWidth',
      'barMinWidth',
      'barGapInGroup',
      'barBackground',
      'barMinHeight',
      'stackCornerRadius',
      'bar',
      'bandWidthField'
    ]);
  }

  transformSpec(spec: T): void {
    super.transformSpec(spec);
    setDefaultCrosshairForCartesianChart(spec);
  }

  protected _setDefaultXAxisSpec(spec: T): ICartesianAxisSpec {
    return {
      orient: 'bottom',
      type: 'linear',
      label: {
        visible: false
      }
    } as ICartesianAxisSpec;
  }

  protected _setDefaultYAxisSpec(spec: T): ICartesianAxisSpec {
    return {
      orient: 'left',
      type: 'linear'
    } as ICartesianAxisSpec;
  }
}
