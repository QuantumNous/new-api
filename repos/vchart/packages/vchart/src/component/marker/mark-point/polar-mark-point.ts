import { ComponentTypeEnum } from '../../interface/type';
import { polarLayout } from '../utils';
import { registerMarkPointAnimate } from '@visactor/vrender-components';
import { Factory } from '../../../core/factory';
import { BaseMarkPoint } from './base-mark-point';
import type { IPolarSeries } from 'src/series';
import type { IMarkProcessOptions } from '../interface';
import { polarToCartesian } from '@visactor/vutils';
import type { CoordinateType } from '../../../typings';
import { markPoint } from '../../../theme/builtin/common/component/mark-point';

export class PolarMarkPoint extends BaseMarkPoint {
  static type = ComponentTypeEnum.polarMarkPoint;
  type = ComponentTypeEnum.polarMarkPoint;
  name: string = ComponentTypeEnum.polarMarkPoint;
  static coordinateType = 'polar';
  coordinateType = 'polar' as CoordinateType;

  static readonly builtInTheme = {
    polarMarkPoint: markPoint
  };

  protected _computePointsAttr() {
    const data = this._markerData;
    const relativeSeries = this._relativeSeries;
    const autoRange = this._spec?.autoRange ?? false;
    const polarPoint = polarLayout(
      data,
      relativeSeries,
      relativeSeries,
      relativeSeries,
      autoRange,
      this._getAutoRangeExtendDomainKeyPrefix()
    )[0][0];
    const center = {
      x:
        this._relativeSeries.getRegion().getLayoutStartPoint().x +
        (this._relativeSeries as IPolarSeries).angleAxisHelper.center().x,
      y:
        this._relativeSeries.getRegion().getLayoutStartPoint().y +
        (this._relativeSeries as IPolarSeries).angleAxisHelper.center().y
    };
    const point = polarToCartesian(center, polarPoint.radius, polarPoint.angle);

    return { point };
  }

  protected _computeOptions(): IMarkProcessOptions {
    const spec = this._spec as any;
    const options = [
      this._processSpecByDims([
        { dim: 'radius', specValue: spec.radius },
        { dim: 'angle', specValue: spec.angle }
      ])
    ];
    return { options };
  }
}

export const registerPolarMarkPoint = () => {
  Factory.registerComponent(PolarMarkPoint.type, PolarMarkPoint);
  registerMarkPointAnimate();
};
