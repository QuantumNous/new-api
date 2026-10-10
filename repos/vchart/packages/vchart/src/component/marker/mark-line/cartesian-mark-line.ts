import { DataView } from '@visactor/vdataset';
import type { IStepMarkLineSpec } from './interface';
import { ComponentTypeEnum } from '../../interface/type';
import type { IOptionAggr, IOptionWithCoordinates, IOptionRegr } from '../../../data/transforms/interface';
import { cartesianCoordinateLayout, positionLayout, xyLayout, getMarkLineProcessInfo } from '../utils';
import {
  type MarkLineAttrs,
  MarkLine as MarkLineComponent,
  registerMarkLineAnimate
} from '@visactor/vrender-components';
import { array, isFunction, isValid, isValidNumber } from '@visactor/vutils';
import type { IDataPos, IMarkProcessOptions } from '../interface';
import { getInsertPoints, getTextOffset } from './util';
import { Factory } from '../../../core/factory';
import { isPercent } from '../../../util';
import type { CoordinateType, IPoint } from '../../../typings';
import { BaseMarkLine } from './base-mark-line';
import { markLine } from '../../../theme/builtin/common/component/mark-line';

export class CartesianMarkLine extends BaseMarkLine {
  static type = ComponentTypeEnum.markLine;
  type = ComponentTypeEnum.markLine;
  name: string = ComponentTypeEnum.markLine;
  static coordinateType = 'cartesian';
  coordinateType = 'cartesian' as CoordinateType;

  static readonly builtInTheme = {
    markLine
  };

  declare protected _markerComponent: MarkLineComponent;

  protected _newMarkLineComponent(attr: MarkLineAttrs): MarkLineComponent {
    return new MarkLineComponent(attr);
  }
  protected _computePointsAttr() {
    const spec = this._spec as any;
    const data = this._markerData;
    const startRelativeSeries = this._startRelativeSeries;
    const endRelativeSeries = this._endRelativeSeries;
    const relativeSeries = this._relativeSeries;

    const isValidCoordinates = isValid(spec.coordinates);
    const isValidProcess = isValid(spec.process);
    const isValidProcessX = isValidProcess && isValid(spec.process.x);
    const isValidProcessY = isValidProcess && isValid(spec.process.y);
    const isPositionLayout = isValid(spec.positions);
    const autoRange = spec.autoRange ?? false;

    const { doXProcess, doYProcess, doXYY1Process, doYXX1Process, doXYProcess, doCoordinatesProcess } =
      getMarkLineProcessInfo(spec);

    let points: IPoint[] = [];
    if (
      doXProcess ||
      doXYY1Process ||
      doYProcess ||
      doYXX1Process ||
      doXYProcess ||
      (isValidCoordinates && isValidProcessX) ||
      (isValidCoordinates && isValidProcessY)
    ) {
      const xyPoints = xyLayout(
        data,
        startRelativeSeries,
        endRelativeSeries,
        relativeSeries,
        autoRange,
        false,
        this._getAutoRangeExtendDomainKeyPrefix()
      );
      // 这里不同的场景返回的值不同，如果同时声明了 x x1 y y1，会返回两个数值的数组（如 [[{}], [{}]]），所以需要分别处理下
      points = (xyPoints.length === 1 ? xyPoints[0] : xyPoints.map(point => point[0])) as IPoint[];
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

  protected _markerLayout() {
    const updateAttrs = this._getUpdateMarkerAttrs();

    if ((this._spec as IStepMarkLineSpec).type === 'type-step') {
      const startRelativeSeries = this._startRelativeSeries;
      const endRelativeSeries = this._endRelativeSeries;

      const { multiSegment, mainSegmentIndex } = (this._spec as IStepMarkLineSpec).line || {};
      const { connectDirection } = this._spec as IStepMarkLineSpec;
      let { expandDistance = 0 } = this._spec as IStepMarkLineSpec;
      const { points, limitRect } = updateAttrs;
      const coordinatePoints = array(points as IPoint[]).filter(Boolean);

      if (isFunction(expandDistance)) {
        const startRegion = startRelativeSeries?.getRegion?.();
        const endRegion = endRelativeSeries?.getRegion?.();
        expandDistance = expandDistance(this._markerData, {
          ...this.getMarkAttributeContext(),
          region: this._relativeSeries?.getRegion?.(),
          startRegion,
          endRegion,
          coordinatePoints
        });
      }

      let expandDistanceValue: number;
      if (isPercent(expandDistance)) {
        const regionStart = startRelativeSeries.getRegion();
        const regionStartLayoutStartPoint = regionStart.getLayoutStartPoint();
        const regionEnd = endRelativeSeries.getRegion();
        const regionEndLayoutStartPoint = regionEnd.getLayoutStartPoint();

        if (connectDirection === 'bottom' || connectDirection === 'top') {
          const regionHeight = Math.abs(
            Math.min(regionStartLayoutStartPoint.y, regionEndLayoutStartPoint.y) -
              Math.max(
                regionStartLayoutStartPoint.y + regionStart.getLayoutRect().height,
                regionEndLayoutStartPoint.y + regionEnd.getLayoutRect().height
              )
          );
          expandDistanceValue = (Number(expandDistance.substring(0, expandDistance.length - 1)) * regionHeight) / 100;
        } else {
          const regionWidth = Math.abs(
            Math.min(regionStartLayoutStartPoint.x, regionEndLayoutStartPoint.x) -
              Math.max(
                regionStartLayoutStartPoint.x + regionStart.getLayoutRect().width,
                regionEndLayoutStartPoint.x + regionEnd.getLayoutRect().width
              )
          );
          expandDistanceValue = (Number(expandDistance.substring(0, expandDistance.length - 1)) * regionWidth) / 100;
        }
      } else {
        expandDistanceValue = expandDistance as number;
      }

      if (!points || points.length < 2) {
        this._markerComponent?.setAttributes(updateAttrs);
        return;
      }

      const joinPoints = getInsertPoints(
        (points as IPoint[])[0],
        (points as IPoint[])[1],
        connectDirection,
        expandDistanceValue
      );

      let labelPositionAttrs: any;
      if (multiSegment && isValid(mainSegmentIndex)) {
        // 如果用户配置了主线段，则不进行 label 的偏移处理，直接显示在主线段中间
        labelPositionAttrs = {
          position: 'middle',
          autoRotate: false
        };
      } else {
        labelPositionAttrs = {
          position: 'start',
          autoRotate: false,
          ...getTextOffset((points as IPoint[])[0], (points as IPoint[])[1], connectDirection, expandDistanceValue)
        };
      }

      const markerComponentAttr = this._markerComponent?.attribute ?? {};
      const prevLabelAttrs = array(markerComponentAttr.label);
      const updateLabels = array(updateAttrs.label);
      const labelsInSpec = array(this._spec.label);
      this._markerComponent?.setAttributes({
        points: multiSegment
          ? [
              [joinPoints[0], joinPoints[1]],
              [joinPoints[1], joinPoints[2]],
              [joinPoints[2], joinPoints[3]]
            ]
          : joinPoints,
        label: updateLabels.map((labelItem, index) => {
          let refX = 0;
          let refY = 0;
          let dx = labelPositionAttrs.dx ?? 0;
          let dy = labelPositionAttrs.dy ?? 0;
          const labelSpec = labelsInSpec[index] ?? labelsInSpec[0];
          if (isValidNumber(labelSpec?.refX)) {
            refX += labelSpec.refX;
          }
          if (isValidNumber(labelSpec?.refY)) {
            refY += labelSpec.refY;
          }
          if (isValidNumber(labelSpec?.dx)) {
            dx += labelSpec.dx;
          }
          if (isValidNumber(labelSpec?.dy)) {
            dy += labelSpec.dy;
          }
          return {
            ...labelItem,
            ...labelPositionAttrs,
            refX,
            refY,
            dx,
            dy,
            textStyle: {
              ...prevLabelAttrs[index]?.textStyle,
              textAlign: 'center',
              textBaseline: 'middle'
            }
          };
        }),
        limitRect,
        multiSegment,
        mainSegmentIndex,
        dx: this._layoutOffsetX,
        dy: this._layoutOffsetY
      } as any);
    } else {
      this._markerComponent?.setAttributes(updateAttrs);
    }
  }

  protected _computeOptions(): IMarkProcessOptions {
    let options: IOptionAggr[] | IOptionRegr | IOptionWithCoordinates;
    let processData: DataView = this._getRelativeDataView();
    let needAggr: boolean = true;
    let needRegr: boolean = false;
    const spec: any = this._spec;
    const relativeSeries = this._relativeSeries;

    const { doXProcess, doYProcess, doXYY1Process, doYXX1Process, doXYProcess, doCoordinatesProcess } =
      getMarkLineProcessInfo(spec);

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
      options = [this._processSpecByDims([{ dim: 'x', specValue: spec.x }])];
    } else if (doYProcess) {
      options = [this._processSpecByDims([{ dim: 'y', specValue: spec.y }])];
    } else if (doXYY1Process) {
      options = [
        this._processSpecByDims([
          { dim: 'x', specValue: spec.x },
          { dim: 'y', specValue: spec.y }
        ]),
        this._processSpecByDims([
          { dim: 'x', specValue: spec.x },
          { dim: 'y', specValue: spec.y1 }
        ])
      ];
    } else if (doYXX1Process) {
      options = [
        this._processSpecByDims([
          { dim: 'x', specValue: spec.x },
          { dim: 'y', specValue: spec.y }
        ]),
        this._processSpecByDims([
          { dim: 'x', specValue: spec.x1 },
          { dim: 'y', specValue: spec.y }
        ])
      ];
    } else if (doCoordinatesProcess) {
      options = this._processSpecCoo(spec);
      needAggr = false;
      processData = new DataView(this._option.dataSet, { name: `${this.type}_${this.id}_data` })
        .parse([relativeSeries.getViewData()], {
          type: 'dataview'
        })
        .transform({
          type: 'markerAggregation',
          options
        });
      if (spec.process && isValid(spec.process.x)) {
        options = [this._processSpecByDims([{ dim: 'x', specValue: spec.process.x as unknown as IDataPos }])];
        needAggr = true;
      }
      if (spec.process && isValid(spec.process.y)) {
        options = options = [this._processSpecByDims([{ dim: 'y', specValue: spec.process.y as unknown as IDataPos }])];
        needAggr = true;
      }
      if (spec.process && isValid(spec.process.xy)) {
        const { xField, yField } = relativeSeries.getSpec();
        options = {
          fieldX: xField,
          fieldY: yField
        };
        needRegr = true;
      }
    } else {
      needAggr = false;
    }
    return { options, needAggr, needRegr, processData };
  }
}

export const registerMarkLine = () => {
  Factory.registerComponent(CartesianMarkLine.type, CartesianMarkLine);
  registerMarkLineAnimate();
};
