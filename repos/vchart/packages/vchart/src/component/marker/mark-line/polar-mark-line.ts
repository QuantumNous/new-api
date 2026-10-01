import type { DataView } from '@visactor/vdataset';
// eslint-disable-next-line no-duplicate-imports
import { ComponentTypeEnum } from '../../interface/type';
// eslint-disable-next-line no-duplicate-imports
import type { IOptionAggr, IOptionWithCoordinates, IOptionRegr } from '../../../data/transforms/interface';
import { polarLayout, getMarkLineProcessInfo, polarCoordinateLayout } from '../utils';
import type { MarkArcLineAttrs, MarkLineAttrs } from '@visactor/vrender-components';
// eslint-disable-next-line no-duplicate-imports
import {
  MarkArcLine as MarkArcLineComponent,
  MarkLine as MarkLineComponent,
  registerMarkArcLineAnimate,
  registerMarkLineAnimate
} from '@visactor/vrender-components';
import { Factory } from '../../../core/factory';
import type { CoordinateType, IPoint, IPolarPoint } from '../../../typings';
import type { IPolarSeries } from 'src/series';
import { BaseMarkLine } from './base-mark-line';
import { polarToCartesian } from '@visactor/vutils';
import { markLine } from '../../../theme/builtin/common/component/mark-line';

export class PolarMarkLine extends BaseMarkLine {
  static type = ComponentTypeEnum.polarMarkLine;
  type = ComponentTypeEnum.polarMarkLine;
  name: string = ComponentTypeEnum.polarMarkLine;
  static coordinateType = 'polar';
  coordinateType = 'polar' as CoordinateType;

  static readonly builtInTheme = {
    polarMarkLine: markLine
  };

  protected declare _markerComponent: MarkArcLineComponent;

  protected _newMarkLineComponent(attr: MarkArcLineAttrs | MarkLineAttrs): MarkArcLineComponent | MarkLineComponent {
    const { doRadiusProcess, doRadAngAng1Process } = getMarkLineProcessInfo(this._spec as any);
    const isArcLine = doRadiusProcess || doRadAngAng1Process;
    return isArcLine
      ? new MarkArcLineComponent(attr as MarkArcLineAttrs)
      : new MarkLineComponent(attr as MarkLineAttrs);
  }

  protected _computePointsAttr() {
    const spec = this._spec as any;
    const data = this._markerData;
    const startRelativeSeries = this._startRelativeSeries;
    const endRelativeSeries = this._endRelativeSeries;
    const relativeSeries = this._relativeSeries;
    const autoRange = spec.autoRange ?? false;

    const {
      doAngleProcess,
      doRadiusProcess,
      doAngRadRad1Process,
      doRadAngAng1Process,
      doRadAngProcess,
      doCoordinatesProcess
    } = getMarkLineProcessInfo(spec);

    let points: IPolarPoint[] = [];
    let pointsAttr: {
      points?: IPoint[];
      radius?: number;
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

    if (doAngleProcess || doRadiusProcess || doAngRadRad1Process || doRadAngAng1Process || doRadAngProcess) {
      const polarPoints = polarLayout(
        data,
        startRelativeSeries as IPolarSeries,
        endRelativeSeries as IPolarSeries,
        relativeSeries as IPolarSeries,
        autoRange,
        this._getAutoRangeExtendDomainKeyPrefix()
      );

      points = (polarPoints.length === 1 ? polarPoints[0] : polarPoints.map(point => point[0])) as IPolarPoint[];

      if (points[0].radius === points[1].radius) {
        pointsAttr = {
          radius: points[0].radius,
          startAngle: points[0].angle,
          endAngle: points[1].angle,
          center
        };
      } else {
        pointsAttr = {
          points: points.map(point => {
            return polarToCartesian(center, point.radius, point.angle);
          })
        };
      }
    } else if (doCoordinatesProcess) {
      points = polarCoordinateLayout(data, relativeSeries, autoRange, this._getAutoRangeExtendDomainKeyPrefix());
      pointsAttr = {
        points: points.map(point => {
          return polarToCartesian(center, point.radius, point.angle);
        })
      };
    }
    return pointsAttr;
  }

  protected _computeOptions(): any {
    const spec = this._spec as any;
    const {
      doAngleProcess,
      doRadiusProcess,
      doAngRadRad1Process,
      doRadAngAng1Process,
      doRadAngProcess,
      doCoordinatesProcess
    } = getMarkLineProcessInfo(spec);

    let options: IOptionAggr[] | IOptionRegr | IOptionWithCoordinates;
    const processData: DataView = this._getRelativeDataView();
    const needAggr: boolean = true;
    const needRegr: boolean = false;

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
      options = [this._processSpecByDims([{ dim: 'angle', specValue: spec.angle }])];
    } else if (doRadiusProcess) {
      options = [this._processSpecByDims([{ dim: 'radius', specValue: spec.radius }])];
    } else if (doAngRadRad1Process) {
      options = [
        this._processSpecByDims([
          { dim: 'angle', specValue: spec.angle },
          { dim: 'radius', specValue: spec.radius }
        ]),
        this._processSpecByDims([
          { dim: 'angle', specValue: spec.angle },
          { dim: 'radius', specValue: spec.radius1 }
        ])
      ];
    } else if (doRadAngAng1Process) {
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
    } else if (doCoordinatesProcess) {
      options = this._processSpecCoo(spec);
    }

    return { options, needAggr, needRegr, processData };
  }
}

export const registerPolarMarkLine = () => {
  Factory.registerComponent(PolarMarkLine.type, PolarMarkLine);
  registerMarkArcLineAnimate();
  registerMarkLineAnimate();
};
