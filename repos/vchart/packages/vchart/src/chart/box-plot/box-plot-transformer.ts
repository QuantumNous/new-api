import { Direction } from '../../typings';
import { CartesianChartSpecTransformer } from '../cartesian';
import { setDefaultCrosshairForCartesianChart } from '../util';
import type { IBoxPlotChartSpec } from './interface';

export class BoxPlotChartSpecTransformer<
  T extends IBoxPlotChartSpec = IBoxPlotChartSpec
> extends CartesianChartSpecTransformer<T> {
  protected _getDefaultSeriesSpec(spec: T): any {
    const dataFields = [spec.maxField, spec.medianField, spec.q1Field, spec.q3Field, spec.minField, spec.outliersField];
    const seriesSpec = super._getDefaultSeriesSpec(spec, [
      'boxPlot',
      'outlier',
      'minField',
      'maxField',
      'q1Field',
      'medianField',
      'q3Field',
      'outliersField',
      'outliersStyle',

      'boxWidth',
      'boxMaxWidth',
      'boxMinWidth',
      'boxGapInGroup'
    ]);
    seriesSpec.direction = spec.direction ?? Direction.vertical;
    seriesSpec[seriesSpec.direction === Direction.horizontal ? 'xField' : 'yField'] = dataFields;

    return seriesSpec;
  }

  transformSpec(spec: T): void {
    super.transformSpec(spec);
    if (!spec.axes) {
      spec.axes = [
        {
          orient: 'bottom'
        },
        {
          orient: 'left'
        }
      ];
    }
    setDefaultCrosshairForCartesianChart(spec);
  }
}
