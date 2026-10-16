/* eslint-disable no-duplicate-imports */
import type { IPolarSeries } from '../../series/interface/series';
import type { IComponentOption } from '../interface';
import { ComponentTypeEnum } from '../interface/type';
import type { IPolarCrosshairSpec } from './interface';
import type { PolygonCrosshairAttrs, CircleCrosshairAttrs } from '@visactor/vrender-components';
import { LineCrosshair, SectorCrosshair, CircleCrosshair, PolygonCrosshair } from '@visactor/vrender-components';
import type { IPolarAxis } from '../axis/polar/interface';
import type { IPoint, IPolarOrientType, StringOrNumber, TooltipActiveType, TooltipData } from '../../typings';
import { BaseCrossHair } from './base';
import type { Maybe } from '@visactor/vutils';
import { polarToCartesian } from '@visactor/vutils';
import type { IGroup, INode } from '@visactor/vrender-core';
import { angleLabelOrientAttribute, radiusLabelOrientAttribute } from '../../util/math';
import { Factory } from '../../core/factory';
import type { IModelSpecInfo } from '../../model/interface';
import { layoutByValue, layoutCrosshair } from './utils/polar';
import { getFirstSeries } from '../../util';
import type { IDimensionData, IDimensionInfo } from '../../event/events/dimension/interface';
import { getSpecInfo } from '../util';
import type { IAxis } from '../axis';
import { crosshair } from '../../theme/builtin/common/component/crosshair';

export class PolarCrossHair<T extends IPolarCrosshairSpec = IPolarCrosshairSpec> extends BaseCrossHair<T> {
  static specKey = 'crosshair';

  static readonly builtInTheme = {
    crosshair
  };
  static type = ComponentTypeEnum.polarCrosshair;
  type = ComponentTypeEnum.polarCrosshair;
  name: string = ComponentTypeEnum.polarCrosshair;

  static getSpecInfo(chartSpec: any): Maybe<IModelSpecInfo[]> {
    return getSpecInfo<IPolarCrosshairSpec>(chartSpec, this.specKey, this.type, (s: IPolarCrosshairSpec) => {
      return (s.categoryField && s.categoryField.visible !== false) || (s.valueField && s.valueField.visible !== false);
    });
  }

  constructor(spec: T, options: IComponentOption) {
    super(spec, options);

    this._stateByField = {
      categoryField: {
        coordKey: 'angle',
        anotherAxisKey: 'radius',
        currentValue: new Map(),
        labelsComp: {
          all: null
        }
      },
      valueField: {
        coordKey: 'radius',
        anotherAxisKey: 'angle',
        currentValue: new Map(),
        labelsComp: {
          all: null
        }
      }
    };
  }

  /**
   * set axis value of crosshair
   */
  setAxisValue(datum: StringOrNumber, axis: IAxis) {
    if ((axis.getOrient() as unknown as IPolarOrientType) === 'radius') {
      this._stateByField.valueField.currentValue.set(axis.getSpecIndex(), {
        datum,
        axis
      });
    } else {
      this._stateByField.categoryField.currentValue.set(axis.getSpecIndex(), {
        datum,
        axis
      });
    }
  }
  /**
   * 查找所有落在x和y区域的轴
   * @param relativeX
   * @param relativeY
   */
  private _findAllAxisContains(relativeX: number, relativeY: number) {
    const angleAxisMap = this._getAxisInfoByField<IPolarAxis>('category');
    const radiusAxisMap = this._getAxisInfoByField<IPolarAxis>('value');
    return {
      angleAxisMap: this._filterAxisByPoint<IPolarAxis>(angleAxisMap, relativeX, relativeY),
      radiusAxisMap: this._filterAxisByPoint<IPolarAxis>(radiusAxisMap, relativeX, relativeY)
    };
  }

  protected _getDatumAtPoint(axis: IPolarAxis, point: IPoint) {
    const { x: axisStartX, y: axisStartY } = axis.getLayoutStartPoint();
    const { x, y } = this.getLayoutStartPoint();
    const datum = axis.positionToData({
      x: point.x - (axisStartX - x),
      y: point.y - (axisStartY - y)
    });

    return datum;
  }

  protected _layoutCrosshair(
    relativeX: number,
    relativeY: number,
    tooltipData?: TooltipData,
    activeType?: TooltipActiveType
  ) {
    let x = relativeX;
    let y = relativeY;

    if (tooltipData && tooltipData.length) {
      if (activeType === 'dimension') {
        const dimensionInfo = (tooltipData as IDimensionInfo[])[0];

        if (dimensionInfo.axis) {
          const triggerCoord = (dimensionInfo.axis as IPolarAxis).pointToCoord({ x, y });
          const isRadius = dimensionInfo.axis.getOrient() === 'radius';
          const coord = isRadius
            ? {
                radius: dimensionInfo.position,
                angle: triggerCoord.angle
              }
            : {
                radius: triggerCoord.radius,
                angle: dimensionInfo.position
              };
          const uniformPos = (dimensionInfo.axis as IPolarAxis).coordToPoint(coord);
          x = uniformPos.x;
          y = uniformPos.y;
        }
      } else if (activeType === 'mark') {
        const dimensionData = (tooltipData as IDimensionData[])[0];
        const pos = dimensionData.series.dataToPosition(dimensionData.datum[0]);

        x = pos.x;
        y = pos.y;
      }
    }
    // 删除之前的currValue
    this.clearAxisValue();

    // 找到所有的包含这个点的轴
    const { angleAxisMap, radiusAxisMap } = this._findAllAxisContains(x, y);
    if (angleAxisMap.size === 0 && radiusAxisMap.size === 0) {
      if (this.enableRemain) {
        return;
      }
      // 隐藏
      this.hide();
      return;
    }

    // 将数据保存到这个对象中，如果不存在，就直接不执行后续逻辑
    angleAxisMap && this._setAllAxisValues(angleAxisMap, { x, y }, 'categoryField');
    radiusAxisMap && this._setAllAxisValues(radiusAxisMap, { x, y }, 'valueField');

    this.layoutByValue();
  }

  layoutByValue(enableRemain?: boolean) {
    if (!this.enable) {
      return;
    }
    const series = getFirstSeries(this._regions, 'polar') as IPolarSeries;
    if (!series) {
      return;
    }

    layoutByValue(this._stateByField, series, enableRemain ?? this.enableRemain);

    Object.keys(this._stateByField).forEach(field => {
      this._layoutByField(field);
    });
  }

  private _layoutByField(fieldName: string) {
    const { cacheInfo, attributes, crosshairComp, labelsComp, coordKey } = this._stateByField[fieldName];
    if (!cacheInfo || (cacheInfo._isCache && this.enableRemain)) {
      return;
    }

    const container = this.getContainer();
    const { visible, labels, coord, sizeRange, axis } = cacheInfo;
    if (visible) {
      const layoutStartPoint = this.getLayoutStartPoint();
      const smooth = this._spec.valueField?.line?.smooth;
      const positionAttrs = layoutCrosshair(this._stateByField[fieldName], layoutStartPoint, smooth);

      if (crosshairComp) {
        crosshairComp.setAttributes(positionAttrs as unknown as any);
      } else {
        let crosshair;

        if (coordKey === 'angle') {
          const crosshairType = attributes.type === 'rect' ? 'sector' : 'line';
          // 创建
          if (crosshairType === 'line') {
            crosshair = new LineCrosshair({
              ...(positionAttrs as { start: IPoint; end: IPoint }),
              lineStyle: attributes.style,
              zIndex: this.gridZIndex,
              pickable: false
            });
          } else if (crosshairType === 'sector') {
            crosshair = new SectorCrosshair({
              ...(positionAttrs as {
                center: IPoint;
                innerRadius: number;
                radius: number;
                startAngle: number;
                endAngle: number;
              }),
              sectorStyle: attributes.style,
              zIndex: this.gridZIndex,
              pickable: false
            });
          }
        } else {
          const crosshairType = smooth ? 'circle' : 'polygon';

          if (crosshairType === 'polygon') {
            crosshair = new PolygonCrosshair({
              ...(positionAttrs as PolygonCrosshairAttrs),
              lineStyle: attributes.style,
              zIndex: this.gridZIndex + 1 // 样式优化：线盖在面上
            });
          } else {
            crosshair = new CircleCrosshair({
              ...(positionAttrs as CircleCrosshairAttrs),
              lineStyle: attributes.style,
              zIndex: this.gridZIndex
            });
          }
        }
        this._stateByField[fieldName].crosshairComp = crosshair as unknown as IGroup;
        // 添加至场景树
        container.add(crosshair as unknown as INode);
      }

      const label = labels.all;
      // 文本
      if (label.visible) {
        const axisCenter = (axis as IPolarAxis).getCenter();
        const center = {
          x: axisCenter.x + layoutStartPoint.x,
          y: axisCenter.y + layoutStartPoint.y
        };
        const orient =
          coordKey === 'angle'
            ? angleLabelOrientAttribute(coord)
            : radiusLabelOrientAttribute((axis as IPolarAxis).startAngle);
        const point =
          coordKey === 'angle'
            ? polarToCartesian(center, sizeRange[1] + label.offset, coord)
            : polarToCartesian(center, positionAttrs.radius, (axis as IPolarAxis).startAngle);

        const labelAttrs = {
          ...point,
          ...attributes.label,
          ...label,
          textStyle: {
            ...attributes.label?.textStyle,
            textAlign: orient.align,
            textBaseline: orient.baseline
          },
          zIndex: this.labelZIndex
        };
        this._updateCrosshairLabel(labelsComp.all, labelAttrs, label => {
          label.name = `crosshair-${coordKey}-label`;
          labelsComp.all = label;
        });
      } else {
        labelsComp.all && labelsComp.all.hideAll();
      }
    }
  }
}

export const registerPolarCrossHair = () => {
  Factory.registerComponent(PolarCrossHair.type, PolarCrossHair);
};
