import { isNil } from '@visactor/vutils';
import type { ICartesianAxisSpec, ICartesianBandAxisSpec, ICartesianLinearAxisSpec } from '../../../component';
import { CartesianChartSpecTransformer } from '../../cartesian';
import type { ILinearProgressChartSpec } from './interface';
import { getLinearAxisSpecDomain } from '../../../component/axis/util';

export class LinearProgressChartSpecTransformer<
  T extends ILinearProgressChartSpec = ILinearProgressChartSpec
> extends CartesianChartSpecTransformer<T> {
  protected needAxes(): boolean {
    return false;
  }

  protected _getDefaultSeriesSpec(spec: T): ILinearProgressChartSpec {
    const series = super._getDefaultSeriesSpec(spec, ['bandWidth', 'progress', 'track', 'clamp']);
    series.direction = spec.direction ?? 'horizontal';

    this._addSeriesRelatedSpecKeys(['cornerRadius']);
    series.cornerRadius = spec.cornerRadius ?? 0;
    return series;
  }

  transformSpec(spec: T): void {
    super.transformSpec(spec);

    if (!spec.axes) {
      spec.axes = [];
    }

    if (spec.direction === 'vertical') {
      let leftAxis: ICartesianLinearAxisSpec = null;
      let bottomAxis: ICartesianBandAxisSpec = null;
      (spec.axes ?? []).forEach((axis: ICartesianAxisSpec) => {
        const { orient } = axis;
        if (orient === 'left') {
          leftAxis = axis;
        }
        if (orient === 'bottom') {
          bottomAxis = axis;
        }
      });
      if (!leftAxis) {
        leftAxis = {
          orient: 'left',
          visible: false
        };
        spec.axes.push(leftAxis);
      }
      if (!bottomAxis) {
        bottomAxis = {
          orient: 'bottom',
          visible: false
        };
        spec.axes.push(bottomAxis);
      }

      // 自动补全轴类型类型和range
      if (isNil(bottomAxis.type)) {
        bottomAxis.type = 'band';
      }
      if (isNil(leftAxis.type)) {
        leftAxis.type = 'linear';
      }
      const domain = getLinearAxisSpecDomain(leftAxis, { min: 0, max: 1 });
      if (isNil(leftAxis.min)) {
        leftAxis.min = domain.min;
      }
      if (isNil(leftAxis.max)) {
        leftAxis.max = domain.max;
      }
    } else {
      let leftAxis: ICartesianBandAxisSpec = null;
      let bottomAxis: ICartesianLinearAxisSpec = null;
      (spec.axes ?? []).forEach((axis: ICartesianAxisSpec) => {
        const { orient } = axis;
        if (orient === 'left') {
          leftAxis = axis;
        }
        if (orient === 'bottom') {
          bottomAxis = axis;
        }
      });
      if (!leftAxis) {
        leftAxis = {
          type: 'band',
          orient: 'left',
          visible: false
        };
        spec.axes.push(leftAxis);
      }
      if (!bottomAxis) {
        bottomAxis = {
          orient: 'bottom',
          visible: false
        };
        spec.axes.push(bottomAxis);
      }

      // 自动补全轴类型类型和range
      if (isNil(bottomAxis.type)) {
        bottomAxis.type = 'linear';
      }
      if (isNil(leftAxis.type)) {
        leftAxis.type = 'band';
      }
      const domain = getLinearAxisSpecDomain(bottomAxis, { min: 0, max: 1 });
      if (isNil(bottomAxis.min)) {
        bottomAxis.min = domain.min;
      }
      if (isNil(bottomAxis.max)) {
        bottomAxis.max = domain.max;
      }
    }
  }
}
