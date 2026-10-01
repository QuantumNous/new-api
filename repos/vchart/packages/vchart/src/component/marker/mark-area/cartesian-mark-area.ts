import { ComponentTypeEnum } from '../../interface/type';
import type { IOptionAggr, IOptionWithCoordinates } from '../../../data/transforms/interface';
import { cartesianCoordinateLayout, getMarkAreaProcessInfo, positionLayout, xyLayout } from '../utils';
import type { MarkAreaAttrs } from '@visactor/vrender-components';
// eslint-disable-next-line no-duplicate-imports
import { MarkArea as MarkAreaComponent, registerMarkAreaAnimate } from '@visactor/vrender-components';
// eslint-disable-next-line no-duplicate-imports
import { isValid } from '@visactor/vutils';
import { Factory } from '../../../core/factory';
import type { CoordinateType, IPoint } from '../../../typings';
import type { IMarkProcessOptions } from '../interface';
import { BaseMarkArea } from './base-mark-area';
import { markArea } from '../../../theme/builtin/common/component/mark-area';

export class CartesianMarkArea extends BaseMarkArea {
  static type = ComponentTypeEnum.markArea;
  type = ComponentTypeEnum.markArea;
  name: string = ComponentTypeEnum.markArea;
  static coordinateType = 'cartesian';
  coordinateType = 'cartesian' as CoordinateType;

  static readonly builtInTheme = {
    markArea
  };

  protected _newMarkAreaComponent(attr: MarkAreaAttrs): MarkAreaComponent {
    return new MarkAreaComponent(attr);
  }

  protected _computePointsAttr() {
    const spec = this._spec as any;
    const data = this._markerData;
    const startRelativeSeries = this._startRelativeSeries;
    const endRelativeSeries = this._endRelativeSeries;
    const relativeSeries = this._relativeSeries;

    const { doXProcess, doYProcess, doXYProcess, doCoordinatesProcess } = getMarkAreaProcessInfo(spec);

    const isPositionLayout = isValid(spec.positions);
    const autoRange = spec.autoRange ?? false;
    const includeFullBand = spec.includeFullBand ?? false;

    let points: IPoint[] = [];
    let lines: IPoint[][] = [];
    if (doXYProcess) {
      lines = xyLayout(
        data,
        startRelativeSeries,
        endRelativeSeries,
        relativeSeries,
        autoRange,
        includeFullBand,
        this._getAutoRangeExtendDomainKeyPrefix()
      );
      // 格式为 [[{x, y}], [{x, y}]]
      // 顺序为左下角开始逆时针绘制
      const [start, end] = lines;
      if (start && start.length && end && end.length) {
        points = [
          {
            x: start[0].x,
            y: end[0].y
          },
          start[0],
          {
            x: end[0].x,
            y: start[0].y
          },
          end[0]
        ];
      }
    } else if (doXProcess || doYProcess) {
      lines = xyLayout(
        data,
        startRelativeSeries,
        endRelativeSeries,
        relativeSeries,
        autoRange,
        includeFullBand,
        this._getAutoRangeExtendDomainKeyPrefix()
      );
      const [start, end] = lines;
      if (start && start.length && end && end.length) {
        points = [...start, end[1], end[0]];
      }
    } else if (doCoordinatesProcess) {
      points = cartesianCoordinateLayout(
        data,
        relativeSeries,
        autoRange,
        spec.coordinatesOffset,
        this._getAutoRangeExtendDomainKeyPrefix()
      );
    } else if (isPositionLayout) {
      points = positionLayout(spec.positions, relativeSeries, spec.regionRelative);
    }

    return { points };
  }

  protected _computeOptions(): IMarkProcessOptions {
    const spec = this._spec as any;
    const { doXProcess, doYProcess, doXYProcess, doCoordinatesProcess } = getMarkAreaProcessInfo(spec);

    let options: IOptionAggr[] | IOptionWithCoordinates;
    if (doXYProcess) {
      options = [
        this._processSpecByDims([
          { dim: 'x', specValue: spec.x },
          { dim: 'y', specValue: spec.y }
        ]),
        this._processSpecByDims([
          { dim: 'x', specValue: spec.x1 },
          { dim: 'y', specValue: spec.y1 }
        ])
      ];
    } else if (doXProcess) {
      options = [
        this._processSpecByDims([{ dim: 'x', specValue: spec.x }]),
        this._processSpecByDims([{ dim: 'x', specValue: spec.x1 }])
      ];
    } else if (doYProcess) {
      options = [
        this._processSpecByDims([{ dim: 'y', specValue: spec.y }]),
        this._processSpecByDims([{ dim: 'y', specValue: spec.y1 }])
      ];
    } else if (doCoordinatesProcess) {
      options = this._processSpecCoo(spec);
    }
    return { options };
  }
}

export const registerMarkArea = () => {
  Factory.registerComponent(CartesianMarkArea.type, CartesianMarkArea);
  registerMarkAreaAnimate();
};
