import { isNil } from '@visactor/vutils';
import type { IPolarAxisSpec, IPolarBandAxisSpec, IPolarLinearAxisSpec } from '../../../component';
import type { IPolarChartSpec } from '../interface';
import { PolarChartSpecTransformer } from '../polar-transformer';
import { getLinearAxisSpecDomain } from '../../../component/axis/util';
import { mergeSpec } from '@visactor/vutils-extension';

export class ProgressLikeChartSpecTransformer<T extends IPolarChartSpec> extends PolarChartSpecTransformer<T> {
  protected needAxes(): boolean {
    return false;
  }

  protected _getDefaultSeriesSpec(spec: any): any {
    const series: any = super._getDefaultSeriesSpec(spec, ['startAngle', 'endAngle', 'centerX', 'centerY', 'clamp']);

    series.categoryField = spec.categoryField || spec.radiusField;
    series.valueField = spec.valueField || spec.angleField;

    return series;
  }

  protected _transformProgressAxisSpec(
    spec: T,
    angleAxisDefaultSpec: IPolarAxisSpec,
    radiusAxisDefaultSpec: IPolarAxisSpec,
    angleAxisAppendSpec?: Partial<IPolarAxisSpec>,
    radiusAxisAppendSpec?: Partial<IPolarAxisSpec>
  ): void {
    if (!spec.axes) {
      spec.axes = [];
    }
    // 找到用户配的角度轴和半径轴
    let radiusAxis: IPolarBandAxisSpec = (spec.axes ?? []).find((axis: IPolarAxisSpec) => axis.orient === 'radius');
    let angleAxis: IPolarLinearAxisSpec = (spec.axes ?? []).find((axis: IPolarAxisSpec) => axis.orient === 'angle');
    // 如果没有找到对应的轴，则自动补充默认配置
    if (!angleAxis) {
      angleAxis = angleAxisDefaultSpec;
      spec.axes.push(angleAxis);
    }
    if (!radiusAxis) {
      radiusAxis = radiusAxisDefaultSpec;
      spec.axes.push(radiusAxis);
    }

    // 在以上配置的基础上，对轴 spec 进行统一修改

    // 自动补充缺失的配置
    if (isNil(angleAxis.type)) {
      angleAxis.type = 'linear';
    }
    if (isNil(radiusAxis.type)) {
      radiusAxis.type = 'band';
    }
    const domain = getLinearAxisSpecDomain(angleAxis, { min: 0, max: 1 });
    if (isNil(angleAxis.min)) {
      angleAxis.min = domain.min;
    }
    if (isNil(angleAxis.max)) {
      angleAxis.max = domain.max;
    }

    // merge 额外的配置
    if (angleAxisAppendSpec) {
      Object.assign(angleAxis, mergeSpec({}, angleAxisAppendSpec, angleAxis));
    }
    if (radiusAxisAppendSpec) {
      Object.assign(radiusAxis, mergeSpec({}, radiusAxisAppendSpec, radiusAxis));
    }
  }
}
