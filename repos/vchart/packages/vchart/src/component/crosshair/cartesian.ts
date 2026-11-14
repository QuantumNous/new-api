import type { Maybe } from '@visactor/vutils';
// eslint-disable-next-line no-duplicate-imports
import { isValid } from '@visactor/vutils';
import type { IComponentOption } from '../interface';
// eslint-disable-next-line no-duplicate-imports
import { ComponentTypeEnum } from '../interface/type';
import type { ICartesianCrosshairSpec } from './interface';
import type { ICartesianSeries } from '../../series/interface';
import { LineCrosshair } from '@visactor/vrender-components/crosshair/line';
import { RectCrosshair } from '@visactor/vrender-components/crosshair/rect';
// eslint-disable-next-line no-duplicate-imports
import { BaseCrossHair } from './base';
import type { INode } from '@visactor/vrender-core';
import type { IAxis } from '../axis/interface';
import type { IOrientType, IPoint, StringOrNumber, TooltipActiveType, TooltipData } from '../../typings';
import { isXAxis, isYAxis } from '../axis/cartesian/util/common';
import { Factory } from '../../core/factory';
import type { IModelSpecInfo } from '../../model/interface';
import { layoutByValue, layoutCrosshair } from './utils/cartesian';
import { getFirstSeries } from '../../util';
import type { IDimensionData, IDimensionInfo } from '../../event/events/dimension/interface';
import { getSpecInfo } from '../util';
import { crosshair } from '../../theme/builtin/common/component/crosshair';

// 1. crosshair保存上次记录的x和y轴dimension
// 2. 每次交互触发时，首先转化成dimension保存，然后依据dimension计算x和y绘制
// 3. 如果同方向同时有多个轴，那么同时保存这些轴的数据
// 4. 如果同方向的轴有多个离散轴，那么直接不显示

export class CartesianCrossHair<T extends ICartesianCrosshairSpec = ICartesianCrosshairSpec> extends BaseCrossHair<T> {
  static specKey = 'crosshair';

  static readonly builtInTheme = {
    crosshair
  };
  static type = ComponentTypeEnum.cartesianCrosshair;
  type = ComponentTypeEnum.cartesianCrosshair;
  name: string = ComponentTypeEnum.cartesianCrosshair;

  static getSpecInfo(chartSpec: any): Maybe<IModelSpecInfo[]> {
    return getSpecInfo<ICartesianCrosshairSpec>(chartSpec, this.specKey, this.type, (s: ICartesianCrosshairSpec) => {
      return (s.xField && s.xField.visible !== false) || (s.yField && s.yField.visible !== false);
    });
  }

  constructor(spec: T, options: IComponentOption) {
    super(spec, options);

    this._stateByField = {
      xField: {
        coordKey: 'x',
        anotherAxisKey: 'y',
        currentValue: new Map(),
        labelsComp: {
          top: null,
          bottom: null
        }
      },
      yField: {
        coordKey: 'y',
        anotherAxisKey: 'x',
        currentValue: new Map(),
        labelsComp: {
          left: null,
          right: null
        }
      }
    };
  }

  /**
   * 查找所有落在x和y区域的轴
   * @param relativeX
   * @param relativeY
   */
  private _findAllAxisContains(relativeX: number, relativeY: number) {
    const xAxisMap = this._getAxisInfoByField<IAxis>('x');
    const yAxisMap = this._getAxisInfoByField<IAxis>('y');
    return {
      xAxisMap: this._filterAxisByPoint(xAxisMap, relativeX, relativeY),
      yAxisMap: this._filterAxisByPoint(yAxisMap, relativeX, relativeY)
    };
  }

  protected _getDatumAtPoint(axis: IAxis, point: IPoint): number | string {
    const dim = isXAxis(axis.getOrient() as unknown as IOrientType) ? 'x' : 'y';
    const coordByAxis = point[dim] - (axis.getLayoutStartPoint()[dim] - this.getLayoutStartPoint()[dim]);
    const value = axis.getScale().invert(coordByAxis);
    return value;
  }

  /**
   * set axis value of crosshair
   */
  setAxisValue(datum: StringOrNumber, axis: IAxis) {
    if (isXAxis(axis.getOrient() as unknown as IOrientType)) {
      this._stateByField.xField.currentValue.set(axis.getSpecIndex(), {
        datum,
        axis
      });
    } else {
      this._stateByField.yField.currentValue.set(axis.getSpecIndex(), {
        datum,
        axis
      });
    }
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
        // 图例筛选时, 找到第一个没有被筛选的系列
        const datumIndex = dimensionInfo.data.findIndex(dimData => dimData.datum.length > 0);
        let pos;
        if (datumIndex > -1) {
          const dimensionData = dimensionInfo.data[datumIndex];
          pos = dimensionData.series.dataToPosition(dimensionData.datum[0]);
        }

        const isY = isValid(dimensionInfo.dimType)
          ? dimensionInfo.dimType === 'y'
          : isYAxis(dimensionInfo?.axis?.getOrient() as IOrientType);

        if (isY) {
          y = pos?.y;
        } else {
          x = pos?.x;
        }
      } else if (activeType === 'mark') {
        const dimensionData = (tooltipData as IDimensionData[])[0];
        const pos = dimensionData.series.dataToPosition(dimensionData.datum[0]);

        x = pos?.x;
        y = pos?.y;
      }
    }
    // 删除之前的currValue
    this.clearAxisValue();
    // 找到所有的包含这个点的轴
    const { xAxisMap, yAxisMap } = this._findAllAxisContains(x, y);
    if ((xAxisMap && xAxisMap.size === 0) || (yAxisMap && yAxisMap.size === 0)) {
      if (this.enableRemain) {
        return;
      }
      // 隐藏
      this.hide();
      return;
    }

    // 将数据保存到这个对象中，如果不存在，就直接不执行后续逻辑
    xAxisMap && xAxisMap.size && this._setAllAxisValues(xAxisMap, { x, y }, 'xField');
    yAxisMap && yAxisMap.size && this._setAllAxisValues(yAxisMap, { x, y }, 'yField');

    this.layoutByValue();
  }

  layoutByValue(enableRemain?: boolean) {
    if (!this.enable) {
      return;
    }
    const series = getFirstSeries(this._regions, 'cartesian') as ICartesianSeries;
    if (!series) {
      return;
    }

    layoutByValue(this._stateByField, series, this.getLayoutStartPoint(), enableRemain ?? this.enableRemain);

    Object.keys(this._stateByField).forEach(field => {
      this._layoutByField(field);
    });
  }

  private _layoutByField(field: string) {
    const { cacheInfo, attributes, labelsComp, bandSize, coordKey } = this._stateByField[field];
    if (!attributes || !cacheInfo || (cacheInfo._isCache && this.enableRemain)) {
      return;
    }

    const { coord, labels, visible, labelsTextStyle } = cacheInfo;

    if (visible) {
      // 外部设置的size
      const positionAttribute = layoutCrosshair(this._stateByField[field]);
      this._updateCrosshairByField(field, positionAttribute);

      Object.keys(labels).forEach(labelKey => {
        if (labels[labelKey].visible) {
          const updateAttrs = {
            [coordKey]: coord + bandSize / 2,
            ...labels[labelKey],
            ...attributes.label,
            angle: attributes.label.syncAxisLabelAngle ? cacheInfo.axisLabel?.attribute.angle ?? 0 : 0,
            textStyle: {
              ...attributes.label?.textStyle,
              ...labelsTextStyle[labelKey]
            },
            zIndex: this.labelZIndex,
            visible: true
          };
          this._updateCrosshairLabel(labelsComp[labelKey], updateAttrs, label => {
            label.name = `crosshair-${field.replace('Field', '')}-${labelKey}-label`;
            labelsComp[labelKey] = label;
          });
        } else {
          labelsComp[labelKey] && labelsComp[labelKey].hideAll();
        }
      });
    } else {
      this._hideByField(field);
    }
  }

  private _updateCrosshairByField(field: string, positionAttribute: any) {
    const container = this.getContainer();
    const { attributes } = this._stateByField[field];
    let { crosshairComp } = this._stateByField[field];

    if (crosshairComp) {
      crosshairComp.setAttributes(positionAttribute);
    } else {
      const style = attributes.style;
      // 创建
      if (attributes.type === 'line') {
        crosshairComp = new LineCrosshair({
          ...positionAttribute,
          lineStyle: style,
          zIndex: this.gridZIndex + 1, // 样式优化：线盖在面上
          disableTriggerEvent: this._option.disableTriggerEvent,
          pickable: false
        });
      } else if (attributes.type === 'rect') {
        crosshairComp = new RectCrosshair({
          ...positionAttribute,
          rectStyle: style,
          zIndex: this.gridZIndex,
          disableTriggerEvent: this._option.disableTriggerEvent,
          pickable: false
        });
      }
      // 添加至场景树
      container?.add(crosshairComp as unknown as INode);

      this._stateByField[field].crosshairComp = crosshairComp;
    }
  }
}

export const registerCartesianCrossHair = () => {
  Factory.registerComponent(CartesianCrossHair.type, CartesianCrossHair);
};
