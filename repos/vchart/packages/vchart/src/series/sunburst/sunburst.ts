/* eslint-disable no-duplicate-imports */
import type { SunburstLabelConfig, SunburstNodeElement } from '@visactor/vlayouts';
import { array, isArray, isNil, isValid, isObject, degreeToRadian, mixin } from '@visactor/vutils';

import type { IMarkSpec } from '../../typings/spec';
import type { IStateAnimateSpec } from '../../animation/spec';
import type { ITextMark, IArcMark } from '../../mark/interface';
import type { Datum, IArcMarkSpec, ITextMarkSpec } from '../../typings';

import type { ISunburstAnimationParams, SunburstAppearPreset } from './animation';
import { registerSunburstAnimation } from './animation';
import type { ISunburstSeriesSpec, LabelAutoVisibleType } from './interface';
import type { ISunburstOpt } from '../../data/transforms/sunburst';

import { registerDataSetInstanceTransform } from '../../data/register';
import { flatten } from '../../data/transforms/flatten';
import { sunburstLayout } from '../../data/transforms/sunburst';
import type { SeriesMarkMap } from '../interface';
import { SeriesTypeEnum } from '../interface/type';

import type { IMark } from '../../mark/interface';
import { MarkTypeEnum } from '../../mark/interface/type';
import { DEFAULT_DATA_KEY } from '../../constant/data';
import { AttributeLevel } from '../../constant/attribute';
import { STATE_VALUE_ENUM } from '../../compile/mark/interface';
import { DEFAULT_HIERARCHY_ROOT } from '../../constant/hierarchy';
import { registerFadeInOutAnimation } from '../../animation/config';
import { addHierarchyDataKey, initHierarchyKeyMap } from '../../data/transforms/data-key';
import { addVChartProperty } from '../../data/transforms/add-property';
import { animationConfig, userAnimationConfig } from '../../animation/utils';
import { PolarSeries } from '../polar/polar';
import { SUNBURST_AUTO_VISIBLE_DEFAULT_THRESHOLD } from '../../constant/sunburst';
import { SunburstTooltipHelper } from './tooltip-helper';
import type { animationInfo } from './animation/interface';
import type { IDrillable } from '../../interaction/drill/drillable';
import { Drillable } from '../../interaction/drill/drillable';
import { registerArcMark } from '../../mark/arc';
import { registerTextMark } from '../../mark/text';
import { sunburstSeriesMark } from './constant';
import { Factory } from '../../core/factory';
import { appendHierarchyFields } from '../util/hierarchy';
import { sunburst } from '../../theme/builtin/common/series/sunburst';

export class SunburstSeries extends PolarSeries<any> {
  protected declare _spec: ISunburstSeriesSpec;

  static readonly type: string = SeriesTypeEnum.sunburst;
  type = SeriesTypeEnum.sunburst;

  static readonly mark: SeriesMarkMap = sunburstSeriesMark;
  static readonly builtInTheme = { sunburst };

  private _sunburstMark: IArcMark;
  private _labelMark: ITextMark;

  protected _categoryField!: string;
  protected _valueField!: string;

  private _centerX: number;
  private _centerY: number;
  private _offsetX: number;
  private _offsetY: number;
  private _startAngle: number;
  private _endAngle: number;

  private __innerRadius: number | number[];
  private __outerRadius: number | number[];
  private _gap: number | number[];
  private _labelLayout: SunburstLabelConfig | SunburstLabelConfig[];

  private _labelAutoVisible?: LabelAutoVisibleType;

  private _label: IMarkSpec<ITextMarkSpec>;
  private _sunburst: IMarkSpec<IArcMarkSpec>;

  setCategoryField(f: string): string {
    this._categoryField = f;
    return this._categoryField;
  }

  getCategoryField() {
    return this._categoryField;
  }

  setValueField(f: string): string {
    this._valueField = f;
    return this._valueField;
  }

  getValueField() {
    return this._valueField;
  }

  getDimensionField() {
    return [this._categoryField];
  }

  getMeasureField(): string[] {
    return [this._valueField];
  }

  setAttrFromSpec() {
    super.setAttrFromSpec();

    this.setCategoryField(this._spec.categoryField);
    this.setValueField(this._spec.valueField);
    this.setSeriesField(this._spec.seriesField ?? DEFAULT_HIERARCHY_ROOT);

    if (this._spec.drill) {
      (this as unknown as IDrillable).initDrillable({
        event: this.event,
        mode: this._option.mode,
        drillField: () => this._spec.drillField ?? DEFAULT_DATA_KEY,
        getRawData: () => this.getRawData()
      });
    }

    /**
     * 角度区间
     */
    this._startAngle = degreeToRadian(this._spec.startAngle);
    this._endAngle = degreeToRadian(this._spec.endAngle);

    /**
     * 中心点
     */
    this._centerX = this._spec.centerX;
    this._centerY = this._spec.centerY;
    this._offsetX = this._spec.offsetX;
    this._offsetY = this._spec.offsetY;

    /**
     * 对所有层生效的布局配置
     */
    this.__innerRadius = this._spec.innerRadius;
    this.__outerRadius = this._spec.outerRadius;
    this._gap = this._spec.gap;
    this._labelLayout = this._spec.labelLayout;

    /**
     * 图元配置
     */
    this._sunburst = this._spec.sunburst;
    this._label = this._spec.label;

    /**
     * 功能配置
     */
    this._labelAutoVisible = this._spec.labelAutoVisible;
  }

  protected initData() {
    super.initData();
    const rawData = this.getRawData();
    if (!rawData) {
      return;
    }

    // 对原始数据进行上卷下钻筛选
    if (this._spec.drill) {
      (this as unknown as IDrillable).initDrillableData(this._dataSet);
    }
    // 注册布局算法
    registerDataSetInstanceTransform(this._dataSet, 'sunburstLayout', sunburstLayout);
    // 注册扁平化算法
    registerDataSetInstanceTransform(this._dataSet, 'flatten', flatten);

    // 对筛选后的数据, 调用sunburst布局算法
    rawData.transform({
      type: 'sunburstLayout',
      options: (): ISunburstOpt => {
        const { innerRadius, outerRadius, gap, label } = this._computeLevel();
        return {
          nodeKey: this._categoryField,
          width: this.getLayoutRect().width,
          height: this.getLayoutRect().height,
          center: [
            isValid(this._centerX) ? this._centerX : this.getLayoutRect().width / 2,
            isValid(this._centerY) ? this._centerY : this.getLayoutRect().height / 2
          ],
          startAngle: this._startAngle,
          endAngle: this._endAngle,

          innerRadius: innerRadius,
          outerRadius: outerRadius,
          gapRadius: gap,
          label: label
        };
      }
    });

    // 布局结果进行扁平化处理
    rawData.transform({
      type: 'flatten',
      options: {
        callback: (node: SunburstNodeElement) => {
          if (node.datum) {
            const nodeData = node.datum[node.depth];
            return { ...node, ...nodeData };
          }
          return node;
        }
      }
    });
  }

  getStatisticFields() {
    return appendHierarchyFields(super.getStatisticFields(), this._categoryField, this._valueField);
  }

  protected _addDataIndexAndKey() {
    const rawData = this.getRawData();
    if (isNil(rawData?.dataSet)) {
      return;
    }
    // 为原始数据, 添加层级属性
    registerDataSetInstanceTransform(rawData.dataSet, 'addVChartProperty', addVChartProperty);
    rawData.transform({
      type: 'addVChartProperty',
      options: {
        beforeCall: initHierarchyKeyMap.bind(this),
        call: addHierarchyDataKey
      }
    });
  }

  initMark(): void {
    this._initArcMark();
    this._initLabelMark();
  }

  initMarkStyle(): void {
    this._initArcMarkStyle();
    this._initLabelMarkStyle();
  }

  private _initArcMark() {
    if (this._sunburst.visible === false) {
      return;
    }
    // SunburstMark
    const sunburstMark = this._createMark(SunburstSeries.mark.sunburst, {
      isSeriesMark: true
    }) as IArcMark;
    this._sunburstMark = sunburstMark;
  }

  private _initArcMarkStyle() {
    if (isNil(this._sunburstMark)) {
      return;
    }
    this.setMarkStyle(
      this._sunburstMark,
      {
        x: d => d.x + (isValid(this._offsetX) ? this._offsetX : 0),
        y: d => d.y + (isValid(this._offsetY) ? this._offsetY : 0),
        outerRadius: d => d.outerRadius,
        innerRadius: d => d.innerRadius,
        startAngle: d => d.startAngle,
        endAngle: d => d.endAngle,
        fill: this.getColorAttribute()
      },
      STATE_VALUE_ENUM.STATE_NORMAL,
      AttributeLevel.Series
    );
  }

  private _initLabelMark() {
    if (this._label.visible !== true) {
      return;
    }
    // Label
    const labelMark = this._createMark(SunburstSeries.mark.label, {
      isSeriesMark: false
    }) as ITextMark;
    this._labelMark = labelMark;
  }

  private _initLabelMarkStyle() {
    if (isNil(this._labelMark)) {
      return;
    }
    this.setMarkStyle(
      this._labelMark,
      {
        visible: (d: Datum) => {
          // 自动隐藏密集标签逻辑.
          const labelAutoVisible = this._labelAutoVisible;

          if (isObject(labelAutoVisible) && labelAutoVisible.enable === true) {
            return (
              (d.endAngle - d.startAngle) * (d.outerRadius - d.innerRadius) >
              (labelAutoVisible?.circumference ?? SUNBURST_AUTO_VISIBLE_DEFAULT_THRESHOLD)
            );
          }
          return this._spec.label.visible;
        },
        x: (d: Datum) => d.label?.x + (isValid(this._offsetX) ? this._offsetX : 0),
        y: (d: Datum) => d.label?.y + (isValid(this._offsetY) ? this._offsetY : 0),
        textBaseline: (d: Datum) => d.label?.textBaseline,
        textAlign: (d: Datum) => d.label?.textAlign,
        angle: (d: Datum) => d.label?.angle ?? 0,
        fontSize: 10,
        text: (d: Datum) => d.name
      },
      STATE_VALUE_ENUM.STATE_NORMAL,
      AttributeLevel.Series
    );
  }

  protected initTooltip() {
    this._tooltipHelper = new SunburstTooltipHelper(this);
    this._sunburstMark && this._tooltipHelper.activeTriggerSet.mark.add(this._sunburstMark);
    this._labelMark && this._tooltipHelper.activeTriggerSet.mark.add(this._labelMark);
  }

  initAnimation() {
    const animationParams: ISunburstAnimationParams = {
      animationInfo: (): animationInfo => {
        // 返回用户的交互元素信息
        return {
          innerRadius: this._computeRadius(array(this.__innerRadius))[0],
          outerRadius: this._computeRadius(array(this.__outerRadius))[0],
          startAngle: array(this._startAngle)[0],
          endAngle: array(this._endAngle)[0]
        };
      }
    };

    const appearPreset = (this._spec?.animationAppear as IStateAnimateSpec<SunburstAppearPreset>)?.preset;

    this.getMarksInType(MarkTypeEnum.arc).forEach(mark => {
      mark.setAnimationConfig(
        animationConfig(
          Factory.getAnimationInKey('sunburst')?.(animationParams, appearPreset),
          userAnimationConfig(mark.name, this._spec, this._markAttributeContext)
        )
      );
    });

    this.getMarksInType(MarkTypeEnum.text).forEach(mark => {
      mark.setAnimationConfig(
        animationConfig(
          Factory.getAnimationInKey('fadeInOut')?.(),
          userAnimationConfig(mark.name, this._spec, this._markAttributeContext)
        )
      );
    });
  }

  initEvent() {
    super.initEvent();
    if (this._spec.drill) {
      (this as unknown as IDrillable).bindDrillEvent();
    }
  }

  onLayoutEnd(): void {
    super.onLayoutEnd();
    this._rawData.reRunAllTransform();
  }

  /**
   * 计算radius, 转换为布局属性
   * @radius radius是一个比例值, 取值范围为[0,1]
   */
  private _computeRadius(radius: number | number[]) {
    if (isArray(radius)) {
      return radius.map(r => {
        return this._computeLayoutRadius() * r;
      });
    }
    return this._computeLayoutRadius() * radius;
  }

  private _computeLevel(): {
    innerRadius: number | number[];
    outerRadius: number | number[];
    gap: number | number[];
    label: SunburstLabelConfig | SunburstLabelConfig[];
  } {
    return {
      innerRadius: this._computeRadius(this.__innerRadius),
      outerRadius: this._computeRadius(this.__outerRadius),
      gap: this._gap,
      label: this._labelLayout
    };
  }

  getGroupFields(): string[] {
    return [];
  }
  getStackGroupFields(): string[] {
    return [];
  }
  getStackValueField(): string {
    return '';
  }

  // make sure this function fast
  protected _noAnimationDataKey(datum: Datum, index: number): unknown | undefined {
    return undefined;
  }

  getActiveMarks(): IMark[] {
    return [this._sunburstMark];
  }

  getMarkData(datum: Datum) {
    return datum?.datum ? datum.datum[datum.datum.length - 1] : datum;
  }
}

mixin(SunburstSeries, Drillable);

export const registerSunBurstSeries = () => {
  Factory.registerSeries(SunburstSeries.type, SunburstSeries);
  registerArcMark();
  registerTextMark();
  registerFadeInOutAnimation();
  registerSunburstAnimation();
};
