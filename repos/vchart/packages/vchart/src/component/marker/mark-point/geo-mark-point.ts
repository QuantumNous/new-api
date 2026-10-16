import { ComponentTypeEnum } from '../../interface/type';
import { geoLayout } from '../utils';
import { registerMarkPointAnimate } from '@visactor/vrender-components';
import { Factory } from '../../../core/factory';
import { BaseMarkPoint } from './base-mark-point';
import type { CoordinateType } from '../../../typings';
import { markPoint } from '../../../theme/builtin/common/component/mark-point';

export class GeoMarkPoint extends BaseMarkPoint {
  static type = ComponentTypeEnum.geoMarkPoint;
  type = ComponentTypeEnum.geoMarkPoint;
  name: string = ComponentTypeEnum.geoMarkPoint;
  static coordinateType: string = 'geo';
  coordinateType = 'geo' as CoordinateType;

  static readonly builtInTheme = {
    geoMarkPoint: markPoint
  };

  protected _computePointsAttr() {
    const data = this._markerData;
    const relativeSeries = this._relativeSeries;
    const point = geoLayout(data, relativeSeries)[0][0];

    return { point };
  }

  protected _computeOptions(): any {
    const spec = this._spec as any;
    const options = [this._processSpecByDims([{ dim: 'areaName', specValue: spec.areaName }])];
    return { options };
  }
}

export const registerGeoMarkPoint = () => {
  Factory.registerComponent(GeoMarkPoint.type, GeoMarkPoint);
  registerMarkPointAnimate();
};
