/* eslint-disable no-duplicate-imports */
import { STATE_VALUE_ENUM } from '../../compile/mark/interface';
import { DEFAULT_DATA_KEY } from '../../constant/data';
import { AttributeLevel } from '../../constant/attribute';
import type { IArcMark, ILabelMark, IMark, IPathMark } from '../../mark/interface';
import { MarkTypeEnum } from '../../mark/interface';
import type { Datum, IArcMarkSpec, IPathMarkSpec, IPoint, StringOrNumber } from '../../typings';
import type { SeriesMarkMap } from '../interface';
import { SeriesTypeEnum } from '../interface/type';
import type { IVennSeriesSpec } from './interface';
import { VennTooltipHelper } from './tooltip-helper';
import { registerFadeInOutAnimation } from '../../animation/config';
import { vennSeriesMark } from './constant';
import { Factory } from '../../core/factory';
import { registerVennAnimation } from './animation';
import { VennSeriesSpecTransformer } from './venn-transform';
import { BaseSeries } from '../base';
import { registerArcMark } from '../../mark/arc';
import { registerPathMark } from '../../mark/path';
import type { IVennCircleDatum, IVennOverlapDatum } from '@visactor/vlayouts';
import { vennMarkTransform } from '@visactor/vlayouts';
import type { IBounds } from '@visactor/vutils';
import { Bounds, array } from '@visactor/vutils';
import { getVennSeriesDataKey } from './util';
import { ComponentTypeEnum } from '../../component/interface';
import { animationConfig, userAnimationConfig } from '../../animation/utils';
import type { ILegend, IDiscreteLegend } from '../../component/legend/interface';
import { registerDataSetInstanceTransform } from '../../data/register';
import { vennLayout } from '../../data/transforms/venn';
import type { ITransformSpec } from '../../compile/interface';
import { venn } from '../../theme/builtin/common/series/venn';

export class VennSeries<T extends IVennSeriesSpec = IVennSeriesSpec> extends BaseSeries<T> {
  static readonly type: string = SeriesTypeEnum.venn;
  type = SeriesTypeEnum.venn;

  static readonly mark: SeriesMarkMap = vennSeriesMark;
  static readonly builtInTheme = { venn };

  static readonly transformerConstructor = VennSeriesSpecTransformer;
  readonly transformerConstructor = VennSeriesSpecTransformer;

  private _circleMark: IArcMark;
  private _overlapMark: IPathMark;
  private _labelMark: ILabelMark;

  protected declare _spec: T;

  // range for venn layout, change while zoom and pan
  private _viewBox: IBounds = new Bounds();

  protected _categoryField!: string;
  getCategoryField() {
    return this._categoryField;
  }
  setCategoryField(f: string): string {
    this._categoryField = f;
    return this._categoryField;
  }

  protected _valueField!: string;
  getValueField() {
    return this._valueField;
  }
  setValueField(f: string): string {
    this._valueField = f;
    return this._valueField;
  }

  setAttrFromSpec(): void {
    super.setAttrFromSpec();
    this.setCategoryField(this._spec.categoryField ?? 'sets');
    this.setValueField(this._spec.valueField ?? 'size');
    this.setSeriesField(this._spec.seriesField ?? DEFAULT_DATA_KEY);
  }

  initData() {
    super.initData();

    registerDataSetInstanceTransform(this._dataSet, 'venn', vennLayout);

    this._data.getDataView()?.transform({
      type: 'venn',
      options: () => ({
        getViewBox: () => {
          return this._viewBox.empty()
            ? null
            : {
                x0: this._viewBox.x1,
                x1: this._viewBox.x2,
                y0: this._viewBox.y1,
                y1: this._viewBox.y2
              };
        },
        setField: this._categoryField,
        valueField: this._valueField
      })
    });
  }

  compile(): void {
    super.compile();
    this._runVennTransform();
  }

  protected _runVennTransform(render = false) {
    this._data.getDataView().reRunAllTransform();
    if (render) {
      this.getCompiler().renderNextTick();
    }
  }

  initMark() {
    const circleMark = this._createMark(VennSeries.mark.circle, {
      isSeriesMark: true
    });
    if (circleMark) {
      circleMark.setTransform([
        {
          type: 'vennMark',
          datumType: 'circle'
        } as ITransformSpec
      ]);
      this._circleMark = circleMark;
    }

    const overlapMark = this._createMark(VennSeries.mark.overlap, {
      isSeriesMark: true
    });
    if (overlapMark) {
      overlapMark.setTransform([
        {
          type: 'vennMark',
          datumType: 'overlap'
        } as ITransformSpec
      ]);
      this._overlapMark = overlapMark;
    }
  }

  initMarkStyle() {
    this._initCircleMarkStyle();
    this._initOverlapMarkStyle();
  }

  protected _initCircleMarkStyle() {
    if (!this._circleMark) {
      return;
    }

    this.setMarkStyle<IArcMarkSpec>(
      this._circleMark,
      {
        x: datum => (datum as IVennCircleDatum).x,
        y: datum => (datum as IVennCircleDatum).y,
        innerRadius: 0,
        outerRadius: datum => (datum as IVennCircleDatum).radius,
        startAngle: 0,
        endAngle: Math.PI * 2,
        fill: this.getColorAttribute(),
        stroke: this.getColorAttribute()
      },
      STATE_VALUE_ENUM.STATE_NORMAL,
      AttributeLevel.Series
    );
  }

  protected _initOverlapMarkStyle() {
    if (!this._overlapMark) {
      return;
    }
    this.setMarkStyle<IPathMarkSpec>(
      this._overlapMark,
      {
        x: datum => (datum as IVennCircleDatum).x,
        y: datum => (datum as IVennCircleDatum).y,
        path: datum => (datum as IVennOverlapDatum).path,
        arcs: (datum: any) => (datum as IVennOverlapDatum).arcs,
        fill: this.getColorAttribute(),
        stroke: this.getColorAttribute(),
        zIndex: datum => {
          // zIndex 按照重叠的深度来分级
          return (datum as IVennOverlapDatum).sets.length * 100;
        }
      },
      STATE_VALUE_ENUM.STATE_NORMAL,
      AttributeLevel.Series
    );
    this.setMarkStyle<IPathMarkSpec>(
      this._overlapMark,
      {
        zIndex: datum => {
          // hover 态的 zIndex 要比同级更高
          return (datum as IVennOverlapDatum).sets.length * 100 + 1;
        }
      },
      STATE_VALUE_ENUM.STATE_HOVER,
      AttributeLevel.Series
    );
  }

  initLabelMarkStyle(labelMark: ILabelMark) {
    if (!labelMark) {
      return;
    }
    this._labelMark = labelMark;
    labelMark.setRule('venn');
    this.setMarkStyle(
      labelMark,
      {
        x: datum => (datum as IVennCircleDatum).labelX,
        y: datum => (datum as IVennCircleDatum).labelY,
        text: datum => getVennSeriesDataKey((datum as IVennCircleDatum).sets),
        maxLineWidth: (datum: any) => {
          const { x, radius, labelX } = datum as IVennCircleDatum;
          const circleX0 = x - radius;
          const circleX1 = x + radius;
          return Math.min(labelX - circleX0, circleX1 - labelX);
        }
      },
      STATE_VALUE_ENUM.STATE_NORMAL,
      AttributeLevel.Series
    );
  }

  initOverlapLabelMarkStyle(labelMark: ILabelMark) {
    if (!labelMark) {
      return;
    }
    this._labelMark = labelMark;
    labelMark.setRule('venn');
    this.setMarkStyle(
      labelMark,
      {
        x: datum => (datum as IVennOverlapDatum).labelX,
        y: datum => (datum as IVennOverlapDatum).labelY,
        text: datum => getVennSeriesDataKey((datum as IVennOverlapDatum).sets)
      },
      STATE_VALUE_ENUM.STATE_NORMAL,
      AttributeLevel.Series
    );
  }

  protected initTooltip() {
    this._tooltipHelper = new VennTooltipHelper(this);
    this._circleMark && this._tooltipHelper.activeTriggerSet.mark.add(this._circleMark);
    this._overlapMark && this._tooltipHelper.activeTriggerSet.mark.add(this._overlapMark);
  }

  getDimensionField() {
    return [this._categoryField];
  }

  getMeasureField(): string[] {
    return [this._valueField];
  }

  onLayoutEnd(): void {
    super.onLayoutEnd();
    this._viewBox.set(0, 0, this.getLayoutRect().width, this.getLayoutRect().height);
    this._runVennTransform();
  }

  getDefaultShapeType(): string {
    return 'circle';
  }

  getActiveMarks(): IMark[] {
    return [this._circleMark, this._overlapMark];
  }

  getStatisticFields() {
    const fields: { key: string; operations: Array<'max' | 'min' | 'values'> }[] = [];
    fields.push({ key: this._categoryField, operations: ['values'] });
    fields.push({ key: this._valueField, operations: ['max', 'min'] });
    return fields;
  }

  getGroupFields(): string[] {
    return null;
  }

  dataToPosition(data: Datum, checkInViewData?: boolean): IPoint {
    return {
      x: data.x,
      y: data.y
    };
  }

  dataToPositionX(data: Datum): number {
    return data.x;
  }

  dataToPositionY(data: Datum): number {
    return data.y;
  }

  valueToPosition(value1: any, value2?: any): IPoint {
    throw new Error('Method not implemented.');
  }

  getStackGroupFields(): string[] {
    return [];
  }

  getStackValueField(): string {
    return null;
  }

  protected _getSeriesInfo(field: string, keys: string[]) {
    const defaultShapeType = this.getDefaultShapeType();
    return keys.map(originalKey => {
      const dataKey = getVennSeriesDataKey(originalKey);
      return {
        key: dataKey,
        originalKey,
        style: this.getSeriesStyle({
          [field]: originalKey
        }),
        shapeType: defaultShapeType
      };
    });
  }

  getSeriesFieldValue(datum: Datum, seriesField?: string) {
    const value = super.getSeriesFieldValue(datum, seriesField);
    return getVennSeriesDataKey(value);
  }

  legendSelectedFilter(component: ILegend, selectedKeys: StringOrNumber[]) {
    if (component.type === ComponentTypeEnum.discreteLegend) {
      const legend = component;

      const originalLegendKeys: any[] = (legend as IDiscreteLegend).getLegendDefaultData(true);
      if (selectedKeys.length === 0 && originalLegendKeys.length) {
        return [];
      }

      if (selectedKeys.length === originalLegendKeys.length) {
        return selectedKeys;
      }

      // 找到缺失的项
      const selectedFilter = {};
      selectedKeys.forEach(s => {
        selectedFilter[s] = true;
      });
      const disableKeys = originalLegendKeys.filter(key => !selectedFilter[getVennSeriesDataKey(key)]);

      // 找到缺失的项的派生项（如 “A&B” 的派生项 “A&B&C”）
      const derivedDisableKeys = originalLegendKeys.filter(key => {
        if (disableKeys.includes(key)) {
          return false;
        }
        return disableKeys.some(disableKey => array(disableKey).every(k => key.includes(k)));
      });

      // 将派生项从 selectedKeys 中移除
      selectedKeys = selectedKeys.slice();
      derivedDisableKeys.forEach(key => {
        selectedKeys.splice(selectedKeys.indexOf(getVennSeriesDataKey(key)), 1);
      });
    }
    return selectedKeys;
  }

  initAnimation(): void {
    this.getMarksInType(MarkTypeEnum.arc).forEach(mark => {
      mark.setAnimationConfig(
        animationConfig(
          Factory.getAnimationInKey('vennCircle')?.(),
          userAnimationConfig(mark.name, this._spec, this._markAttributeContext)
        )
      );
    });
    this.getMarksInType(MarkTypeEnum.path).forEach(mark => {
      mark.setAnimationConfig(
        animationConfig(
          Factory.getAnimationInKey('vennOverlap')?.(),
          userAnimationConfig(mark.name, this._spec, this._markAttributeContext)
        )
      );
    });
  }
}

export const registerVennSeries = () => {
  registerArcMark();
  registerPathMark();
  registerVennAnimation();
  registerFadeInOutAnimation();
  Factory.registerGrammarTransform('vennMark', {
    transform: vennMarkTransform
  });
  Factory.registerSeries(VennSeries.type, VennSeries);
};
