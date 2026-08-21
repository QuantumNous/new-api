import type { IMarkPointCoordinateSpec } from './interface';
import { ComponentTypeEnum } from '../../interface/type';
import { cartesianCoordinateLayout, getMarkPointProcessInfo, positionLayout, xyLayout } from '../utils';
import { registerMarkPointAnimate } from '@visactor/vrender-components';
import { isValid } from '@visactor/vutils';
import { Factory } from '../../../core/factory';
import type { CoordinateType, IPoint } from '../../../typings';
import { BaseMarkPoint } from './base-mark-point';
import type { IMarkProcessOptions } from '../interface';
import type { IOptionAggr, IOptionWithCoordinates } from '../../../data/transforms/interface';
import { markPoint } from '../../../theme/builtin/common/component/mark-point';

export class CartesianMarkPoint extends BaseMarkPoint {
  static type = ComponentTypeEnum.markPoint;
  type = ComponentTypeEnum.markPoint;
  name: string = ComponentTypeEnum.markPoint;
  static coordinateType = 'cartesian';
  coordinateType = 'cartesian' as CoordinateType;

  static readonly builtInTheme = {
    markPoint: markPoint
  };

  protected _computePointsAttr() {
    const spec = this._spec as any;
    const data = this._markerData;
    const relativeSeries = this._relativeSeries;
    const isXYLayout = isValid(spec.x) && isValid(spec.y);
    const isCoordinateLayout = isValid(spec.coordinate);
    const isPositionLayout = isValid(spec.position);
    const autoRange = spec?.autoRange ?? false;

    let point: IPoint;

    if (isXYLayout) {
      point = xyLayout(
        data,
        relativeSeries,
        relativeSeries,
        relativeSeries,
        autoRange,
        false,
        this._getAutoRangeExtendDomainKeyPrefix()
      )?.[0]?.[0];
    } else if (isCoordinateLayout) {
      point = cartesianCoordinateLayout(
        data,
        relativeSeries,
        autoRange,
        (spec as IMarkPointCoordinateSpec).coordinatesOffset,
        this._getAutoRangeExtendDomainKeyPrefix()
      )[0];
    } else if (isPositionLayout) {
      point = positionLayout(spec.position, relativeSeries, spec.regionRelative)[0];
    }

    return { point };
  }

  protected _computeOptions(): IMarkProcessOptions {
    const spec = this._spec as any;
    const { doXYProcess } = getMarkPointProcessInfo(spec);
    const isCoordinateProcess = isValid(spec.coordinate);

    let options: IOptionAggr[] | IOptionWithCoordinates;
    if (doXYProcess) {
      options = [
        this._processSpecByDims([
          { dim: 'x', specValue: spec.x },
          { dim: 'y', specValue: spec.y }
        ])
      ];
    } else if (isCoordinateProcess) {
      options = this._processSpecCoo(spec);
    }

    return { options };
  }
}

export const registerMarkPoint = () => {
  Factory.registerComponent(CartesianMarkPoint.type, CartesianMarkPoint);
  registerMarkPointAnimate();
};
