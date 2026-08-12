import { ComponentTypeEnum } from '../../interface/type';
import type { IOptionAggr, IOptionWithCoordinates } from '../../../data/transforms/interface';
import { getMarkAreaProcessInfo, polarCoordinateLayout, polarLayout } from '../utils';
import type { MarkArcAreaAttrs, MarkAreaAttrs } from '@visactor/vrender-components';
// eslint-disable-next-line no-duplicate-imports
import {
  MarkArcArea as MarkArcAreaComponent,
  MarkArea as MarkAreaComponent,
  registerMarkArcAreaAnimate,
  registerMarkAreaAnimate
} from '@visactor/vrender-components';
import { Factory } from '../../../core/factory';
import type { CoordinateType, IPoint, IPolarPoint } from '../../../typings';
import type { IPolarSeries } from 'src/series';
import { BaseMarkArea } from './base-mark-area';
import type { IMarkProcessOptions } from '../interface';
import { polarToCartesian } from '@visactor/vutils';
import { markArea } from '../../../theme/builtin/common/component/mark-area';

export class PolarMarkArea extends BaseMarkArea {
  static type = ComponentTypeEnum.polarMarkArea;
  type = ComponentTypeEnum.polarMarkArea;
  name: string = ComponentTypeEnum.polarMarkArea;
  static coordinateType = 'polar';
  coordinateType = 'polar' as CoordinateType;

  static readonly builtInTheme = {
    polarMarkArea: markArea
  };

  protected declare _markerComponent: MarkArcAreaComponent;

  protected _newMarkAreaComponent(attr: MarkArcAreaAttrs | MarkAreaAttrs): MarkArcAreaComponent | MarkAreaComponent {
    const { doRadiusProcess, doAngleProcess, doRadAngProcess } = getMarkAreaProcessInfo(this._spec as any);
    const isArcArea = doAngleProcess || doRadiusProcess || doRadAngProcess;
    return isArcArea
      ? new MarkArcAreaComponent(attr as MarkArcAreaAttrs)
      : new MarkAreaComponent(attr as MarkAreaAttrs);
  }

  protected _computePointsAttr() {
    const spec = this._spec as any;
    const data = this._markerData;
    const startRelativeSeries = this._startRelativeSeries;
    const endRelativeSeries = this._endRelativeSeries;
    const relativeSeries = this._relativeSeries;
    const { doAngleProcess, doRadiusProcess, doRadAngProcess, doCoordinatesProcess } = getMarkAreaProcessInfo(spec);

    const autoRange = spec.autoRange ?? false;

    let points: IPolarPoint[];
    let pointsAttr: {
      points?: IPoint[] | IPolarPoint[];
      innerRadius?: number;
      outerRadius?: number;
      startAngle?: number;
      endAngle?: number;
      center?: IPoint;
    } = {};
    const center = {
      x:
        this._relativeSeries.getRegion().getLayoutStartPoint().x +
        (this._relativeSeries as IPolarSeries).angleAxisHelper.center().x,
      y:
        this._relativeSeries.getRegion().getLayoutStartPoint().y +
        (this._relativeSeries as IPolarSeries).angleAxisHelper.center().y
    };

    if (doAngleProcess || doRadiusProcess || doRadAngProcess) {
      const polarLines = polarLayout(
        data,
        startRelativeSeries as IPolarSeries,
        endRelativeSeries as IPolarSeries,
        relativeSeries as IPolarSeries,
        autoRange,
        this._getAutoRangeExtendDomainKeyPrefix()
      );
      if (doRadAngProcess) {
        pointsAttr = {
          innerRadius: polarLines[0][0].radius,
          outerRadius: polarLines[1][0].radius,
          startAngle: polarLines[0][0].angle,
          endAngle: polarLines[1][0].angle,
          center
        };
      } else if (doAngleProcess) {
        pointsAttr = {
          innerRadius: 0,
          outerRadius: Math.abs(polarLines[0][0].radius),
          startAngle: polarLines[0][1].angle,
          endAngle: polarLines[1][1].angle,
          center
        };
      } else if (doRadiusProcess) {
        pointsAttr = {
          innerRadius: polarLines[0][0].radius,
          outerRadius: polarLines[1][0].radius,
          startAngle: polarLines[0][0].angle,
          endAngle: polarLines[1][1].angle,
          center
        };
      }
    } else if (doCoordinatesProcess) {
      points = polarCoordinateLayout(
        data,
        relativeSeries as IPolarSeries,
        autoRange,
        this._getAutoRangeExtendDomainKeyPrefix()
      );
      pointsAttr = {
        points: points.map(point => {
          return polarToCartesian(center, point.radius, point.angle);
        })
      };
    }

    return pointsAttr;
  }

  protected _computeOptions(): IMarkProcessOptions {
    const spec = this._spec as any;
    const { doAngleProcess, doRadiusProcess, doRadAngProcess, doCoordinatesProcess } = getMarkAreaProcessInfo(spec);

    let options: IOptionAggr[] | IOptionWithCoordinates;
    if (doRadAngProcess) {
      options = [
        this._processSpecByDims([
          { dim: 'angle', specValue: spec.angle },
          { dim: 'radius', specValue: spec.radius }
        ]),
        this._processSpecByDims([
          { dim: 'angle', specValue: spec.angle1 },
          { dim: 'radius', specValue: spec.radius1 }
        ])
      ];
    } else if (doAngleProcess) {
      options = [
        this._processSpecByDims([
          { dim: 'angle', specValue: spec.angle },
          { dim: 'radius', specValue: spec.radius }
        ]),
        this._processSpecByDims([
          { dim: 'angle', specValue: spec.angle1 },
          { dim: 'radius', specValue: spec.radius }
        ])
      ];
    } else if (doRadiusProcess) {
      options = [
        this._processSpecByDims([{ dim: 'radius', specValue: spec.radius }]),
        this._processSpecByDims([{ dim: 'radius', specValue: spec.radius1 }])
      ];
    } else if (doCoordinatesProcess) {
      options = this._processSpecCoo(spec);
    }

    return { options };
  }
}

export const registerPolarMarkArea = () => {
  Factory.registerComponent(PolarMarkArea.type, PolarMarkArea);
  registerMarkArcAreaAnimate();
  registerMarkAreaAnimate();
};
