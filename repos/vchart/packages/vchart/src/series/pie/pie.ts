/* eslint-disable no-duplicate-imports */
import { degreeToRadian, isValid } from '@visactor/vutils';
import { DataView } from '@visactor/vdataset';
import {
  ARC_START_ANGLE,
  ARC_END_ANGLE,
  ARC_RATIO,
  ARC_MIDDLE_ANGLE,
  ARC_RADIAN,
  ARC_QUADRANT,
  ARC_K,
  POLAR_START_RADIAN,
  POLAR_END_RADIAN
} from '../../constant/polar';
import { AttributeLevel } from '../../constant/attribute';
import { DEFAULT_DATA_KEY, DEFAULT_DATA_INDEX } from '../../constant/data';
import { PREFIX } from '../../constant/base';
import type { IPoint, Datum, StateValueType, IArcMarkSpec, ILayoutNumber } from '../../typings';
import { normalizeStartEndAngle } from '../../util/math';
import { isSpecValueWithScale } from '../../util/scale';
import { field } from '../../util/object';
import { PolarSeries } from '../polar/polar';
import type { ISeriesSpecUpdatePolicy } from '../base/base-series';
import type { IArcMark, IMark, IMarkStyle, IPathMark, ITextMark } from '../../mark/interface';
import { MarkTypeEnum } from '../../mark/interface/type';
import type { IArcSeries, SeriesMarkMap } from '../interface';
import { SeriesMarkNameEnum, SeriesTypeEnum } from '../interface/type';
import type { IPieOpt } from '../../data/transforms/pie';
// eslint-disable-next-line no-duplicate-imports
import { pie } from '../../data/transforms/pie';
import { registerDataSetInstanceTransform } from '../../data/register';
import { registerEmptyCircleAnimation, registerPieAnimation } from './animation/animation';
import { animationConfig, shouldMarkDoMorph, userAnimationConfig } from '../../animation/utils';
import type { IAnimationTypeConfig, TypeAnimationConfig } from '../../animation/interface';
import { AnimationStateEnum } from '../../animation/interface';
import type {
  IBasePieSeriesSpec,
  IPieAnimationParams,
  IPieSeriesSpec,
  IPieSeriesTheme,
  PieAppearPreset
} from './interface';
import type { IStateAnimateSpec } from '../../animation/spec';
import { centerOffsetConfig } from './animation/centerOffset';
import { registerArcMark } from '../../mark/arc';
import { pieSeriesMark } from './constant';
import { Factory } from '../../core/factory';
import { isNil, polarToCartesian } from '@visactor/vutils';
import { PieSeriesSpecTransformer } from './pie-transformer';
import { DEFAULT_LABEL_VISIBLE } from '../../constant/label';
import { ChartEvent } from '../../constant/event';
import { computeLayoutRadius } from '../../component/axis/polar/util/common';
import { calcLayoutNumber } from '../../util/space';
import type { ICompilableData } from '../../compile/data';
import { CompilableData } from '../../compile/data';
import { pie as pieTheme } from '../../theme/builtin/common/series/pie';

const PIE_SERIES_DATA_RELATED_KEYS: Record<'valueField' | 'angleField' | 'startAngle' | 'endAngle' | 'minAngle', true> =
  {
    valueField: true,
    angleField: true,
    startAngle: true,
    endAngle: true,
    minAngle: true
  };

const PIE_SERIES_COMPILE_ONLY_KEYS: Record<'outerRadius', true> = {
  outerRadius: true
};

export class BasePieSeries<T extends IBasePieSeriesSpec> extends PolarSeries<T> implements IArcSeries {
  static readonly transformerConstructor = PieSeriesSpecTransformer as any;
  readonly transformerConstructor = PieSeriesSpecTransformer;

  protected _pieMarkName: string = SeriesMarkNameEnum.pie;
  protected _pieMarkType: string = MarkTypeEnum.arc;

  static readonly mark: SeriesMarkMap = pieSeriesMark;
  static readonly builtInTheme: Record<string, IPieSeriesTheme> = { pie: pieTheme };

  protected _viewDataLabel!: ICompilableData;

  // 饼图渲染不依赖于极坐标系轴，因此由 series 自己存储相关配置信息
  getCenter = (): IPoint => {
    const layoutRect = this._region.getLayoutRect();

    return {
      x: calcLayoutNumber(this._spec?.centerX as ILayoutNumber, layoutRect.width, layoutRect, layoutRect.width / 2),
      y: calcLayoutNumber(this._spec?.centerY as ILayoutNumber, layoutRect.height, layoutRect, layoutRect.height / 2)
    };
  };
  protected _centerOffset!: number;

  protected _cornerRadius!: number;

  protected _startAngle: number = POLAR_START_RADIAN;
  protected _endAngle: number = POLAR_END_RADIAN;
  protected _padAngle!: number;

  protected _pieMark: IArcMark | null = null;
  protected _labelMark: ITextMark | null = null;
  protected _labelLineMark: IPathMark | null = null;

  protected _showEmptyCircle: boolean;
  protected _emptyArcMark: IArcMark | null = null;

  protected _showAllZero: boolean;
  protected _supportNegative: boolean;

  protected _buildMarkAttributeContext() {
    super._buildMarkAttributeContext();
    // center
    this._markAttributeContext.getCenter = () => ({
      x: () => this.getCenter().x,
      y: () => this.getCenter().y
    });

    // angle scale
    this._markAttributeContext.startAngleScale = (datum: Datum) => this.startAngleScale(datum);
    this._markAttributeContext.endAngleScale = (datum: Datum) => this.endAngleScale(datum);
  }

  setAttrFromSpec(): void {
    super.setAttrFromSpec();
    this._centerOffset = this._spec.centerOffset ?? 0;
    this._cornerRadius = this._spec.cornerRadius ?? 0;

    const normalized = normalizeStartEndAngle(
      isValid(this._spec.startAngle) ? degreeToRadian(this._spec.startAngle) : this._startAngle,
      isValid(this._spec.endAngle) ? degreeToRadian(this._spec.endAngle) : this._endAngle
    );
    this._startAngle = normalized.startAngle;
    this._endAngle = normalized.endAngle;
    this._padAngle = isValid(this._spec.padAngle) ? degreeToRadian(this._spec.padAngle) : 0;

    // 值信息给角度，angleField 是为了兼容小组件用法，因为 spec 改造前已经开放了
    this.setAngleField(this._spec.valueField || this._spec.angleField);
    if (this._spec.categoryField) {
      this.setSeriesField(this._spec.categoryField);
    }
    this._radiusField = [];

    this._specAngleField = this._angleField.slice();
    this._specRadiusField = [];

    this._showEmptyCircle = this._spec.emptyPlaceholder?.showEmptyCircle ?? false;

    this._showAllZero = this._spec.showAllZero ?? false;
    this._supportNegative = this._spec.supportNegative ?? false;
  }

  initData() {
    super.initData();

    const viewData = this.getViewData();
    if (!viewData) {
      return;
    }

    registerDataSetInstanceTransform(this._dataSet, 'pie', pie);

    viewData.transform(
      {
        type: 'pie',
        options: {
          angleField: () => this._angleField[0],
          startAngle: () => this._startAngle,
          endAngle: () => this._endAngle,
          minAngle: () => (isValid(this._spec.minAngle) ? degreeToRadian(this._spec.minAngle) : 0),
          asStartAngle: ARC_START_ANGLE,
          asEndAngle: ARC_END_ANGLE,
          asRatio: ARC_RATIO,
          asMiddleAngle: ARC_MIDDLE_ANGLE,
          asRadian: ARC_RADIAN,
          asQuadrant: ARC_QUADRANT,
          asK: ARC_K,
          showAllZero: this._showAllZero,
          supportNegative: this._supportNegative,
          showEmptyCircle: this._showEmptyCircle
        } as IPieOpt
      },
      false
    );

    const viewDataLabel = new DataView(this._dataSet, { name: `${PREFIX}_series_${this.id}_viewDataLabel` });
    viewDataLabel.parse([this.getViewData()], {
      type: 'dataview'
    });

    this._viewDataLabel = new CompilableData(this._option, viewDataLabel);
  }

  compileData() {
    super.compileData();
    this._viewDataLabel?.compile();
  }

  initMark(): void {
    this._pieMark = this._createMark(
      {
        ...BasePieSeries.mark.pie,
        name: this._pieMarkName,
        type: this._pieMarkType
      },
      {
        key: DEFAULT_DATA_KEY,
        groupKey: this._seriesField,
        isSeriesMark: true
      },
      {
        morph: shouldMarkDoMorph(this._spec, this._pieMarkName),
        morphElementKey: this._seriesField
      }
    ) as IArcMark;

    if (this._showEmptyCircle) {
      this._emptyArcMark = this._createMark(
        {
          name: 'emptyCircle',
          type: 'arc'
        },
        {
          dataView: false
        }
      ) as IArcMark;

      this._data.addRelatedMark(this._emptyArcMark);
    }
  }

  private startAngleScale(datum: Datum) {
    return field(ARC_START_ANGLE)(datum);
  }

  private endAngleScale(datum: Datum) {
    return field(ARC_END_ANGLE)(datum);
  }

  protected _computeLayoutRadius() {
    return computeLayoutRadius(
      () => this._spec.layoutRadius,
      this.getLayoutRect,
      this.getCenter,
      () => ({ startAngle: this._startAngle, endAngle: this._endAngle })
    );
  }

  initMarkStyle(): void {
    const initialStyle: Partial<IMarkStyle<IArcMarkSpec>> = {
      x: () => this.getCenter().x,
      y: () => this.getCenter().y,
      fill: this.getColorAttribute(),
      outerRadius: isSpecValueWithScale(this._outerRadius)
        ? this._outerRadius
        : () => this._computeLayoutRadius() * this._outerRadius,
      innerRadius: isSpecValueWithScale(this._innerRadius)
        ? this._innerRadius
        : () => this._computeLayoutRadius() * this._innerRadius,
      cornerRadius: () => this._computeLayoutRadius() * this._cornerRadius,
      startAngle: datum => this.startAngleScale(datum),
      endAngle: datum => this.endAngleScale(datum),
      padAngle: this._padAngle,
      centerOffset: this._centerOffset
    };

    const pieMark = this._pieMark;
    if (pieMark) {
      this.setMarkStyle(pieMark, initialStyle, 'normal', AttributeLevel.Series);
    }

    /**
     * !important
     * !TODO: isDataEmpty执行了2次, 需要结构上优化, 保存isEmpty的状态, 尝试将2次执行优化为1次
     */
    const emptyPieMark = this._emptyArcMark;
    if (emptyPieMark) {
      this.setMarkStyle(
        emptyPieMark,
        {
          ...initialStyle,
          visible: () => {
            const data = this.getViewData().latestData;
            return !data || !data.length;
          }
        },
        'normal',
        AttributeLevel.Series
      );
    }
  }

  getInteractionTriggers() {
    return this._parseInteractionConfig(this._pieMark ? [this._pieMark] : []);
  }

  protected initTooltip() {
    super.initTooltip();

    this._pieMark && this._tooltipHelper.activeTriggerSet.mark.add(this._pieMark);
  }

  initMarkStyleWithSpec(mark?: IMark, spec?: any): void {
    super.initMarkStyleWithSpec(mark, spec);
    if (mark.name === this._pieMarkName) {
      // radius 配置需要额外处理比例值
      const pieSpec = this.getSpec()[mark.name as 'pie'];
      if (pieSpec) {
        for (const state in pieSpec.state || {}) {
          this.setMarkStyle(mark, this.generateRadiusStyle(pieSpec.state[state]), state, AttributeLevel.User_Mark);
        }
      }
    }
    if (mark.name === 'emptyCircle') {
      // 使用emptyCircle的radius比例值进行覆盖
      this.setMarkStyle(mark, this.generateRadiusStyle(spec.style), 'normal', AttributeLevel.User_Mark);
    }
  }

  initLabelMarkStyle(textMark: ITextMark) {
    if (!textMark) {
      return;
    }
    this.setMarkStyle(textMark, {
      visible: field(DEFAULT_LABEL_VISIBLE).bind(this),
      text: (datum: Datum) => {
        return datum[this.getDimensionField()[0]];
      },
      fill: this.getColorAttribute(),
      z: this.dataToPositionZ.bind(this)
    });
  }

  afterInitMark(): void {
    super.afterInitMark();
  }

  initEvent(): void {
    super.initEvent();
    this._viewDataLabel.getDataView()?.target.addListener('change', this.viewDataLabelUpdate.bind(this));
  }

  // 饼图不支持分组
  initGroups() {
    return;
  }

  /**
   * @override
   * @param ctx
   */
  onLayoutEnd(): void {
    this._viewDataLabel.getDataView().reRunAllTransform();
    this.onMarkPositionUpdate();
    super.onLayoutEnd();
  }

  getDimensionField(): string[] {
    return this._seriesField ? [this._seriesField] : [];
  }
  getMeasureField(): string[] {
    return this._specAngleField;
  }

  private viewDataLabelUpdate() {
    this.event.emit(ChartEvent.viewDataLabelUpdate, { model: this });
    this._viewDataLabel.updateData();
  }

  protected generateRadiusStyle(spec: any) {
    if (!spec) {
      return;
    }
    const style: any = {};
    spec.outerRadius && (style.outerRadius = () => this._computeLayoutRadius() * spec.outerRadius);
    spec.innerRadius && (style.innerRadius = () => this._computeLayoutRadius() * spec.innerRadius);
    spec.cornerRadius && (style.cornerRadius = () => this._computeLayoutRadius() * spec.cornerRadius);
    return style;
  }

  computeCenter(datum: Datum): IPoint {
    return {
      x: this._pieMark.getAttribute('x', datum, 'normal') as number,
      y: this._pieMark.getAttribute('y', datum, 'normal') as number
    };
  }

  getRadius(state: StateValueType = 'normal'): number {
    const styleRadius =
      state === 'normal'
        ? (this.getSpec() as any)[this._pieMark?.name || 'pie']?.style?.outerRadius
        : (this.getSpec() as any)[this._pieMark?.name || 'pie']?.state?.[state]?.outerRadius;
    return styleRadius ?? this._outerRadius;
  }

  getInnerRadius(state: StateValueType = 'normal'): number {
    const styleRadius =
      state === 'normal'
        ? (this.getSpec() as any)[this._pieMark?.name || 'pie']?.style?.innerRadius
        : (this.getSpec() as any)[this._pieMark?.name || 'pie']?.state?.[state]?.innerRadius;
    return styleRadius ?? this._innerRadius;
  }

  computeRadius(r: number, k?: number): number {
    return this._computeLayoutRadius() * r * (isNil(k) ? 1 : k) + this._centerOffset;
  }

  computeDatumRadius(datum: Datum, state?: string): number {
    return this._computeLayoutRadius() * this.getRadius(state) + this._centerOffset;
  }

  protected _getSpecUpdatePolicy(): ISeriesSpecUpdatePolicy {
    const policy = super._getSpecUpdatePolicy();
    return {
      ...policy,
      compileOnlyKeys: {
        ...policy.compileOnlyKeys,
        ...PIE_SERIES_COMPILE_ONLY_KEYS
      },
      dataRelatedKeys: {
        ...policy.dataRelatedKeys,
        ...PIE_SERIES_DATA_RELATED_KEYS
      }
    };
  }

  _compareSpec(spec: T, prevSpec: T, ignoreCheckKeys?: { [key: string]: true }) {
    ignoreCheckKeys = ignoreCheckKeys ?? { data: true };
    const defaultIgnoreKeys: string[] = [
      'centerX',
      'centerY',
      'centerOffset',
      'radius',
      'innerRadius',
      'cornerRadius',
      'startAngle',
      'endAngle',
      'padAngle'
    ];
    defaultIgnoreKeys.forEach(key => {
      ignoreCheckKeys[key] = true;
    });

    const result = super._compareSpec(spec, prevSpec, ignoreCheckKeys);
    spec = spec ?? ({} as T);
    if (defaultIgnoreKeys.some(key => (spec as any)[key] !== (prevSpec as any)[key])) {
      result.reRender = true;
      result.change = true;
    }
    return result;
  }

  computeDatumInnerRadius(datum: Datum, state?: string): number {
    return this._computeLayoutRadius() * this.getInnerRadius(state) + this._centerOffset;
  }

  dataToPosition(datum: Datum, checkInViewData?: boolean): IPoint | null {
    const angle = datum[ARC_MIDDLE_ANGLE];
    if (isNil(angle)) {
      return null;
    }
    if (checkInViewData && !this.isDatumInViewData(datum)) {
      return null;
    }
    const radius = this.computeDatumRadius(datum);
    const center = this.computeCenter(datum);

    return polarToCartesian(center, radius, angle);
  }

  dataToCentralPosition = (datum: Datum): IPoint | null => {
    // 和 PieSeries.dataToPosition 实现不同，这里考虑了美观性，返回的位置是曲边梯形的中心
    const angle = datum[ARC_MIDDLE_ANGLE];
    if (isNil(angle)) {
      return null;
    }
    const radius = this.computeDatumRadius(datum);
    const innerRadius = this.computeDatumInnerRadius(datum);
    const center = this.computeCenter(datum);

    return polarToCartesian(center, (radius + innerRadius) / 2, angle);
  };

  initAnimation() {
    const animationParams: IPieAnimationParams = {
      growFrom: (datum, graphic, state) => {
        if (state === AnimationStateEnum.appear) {
          return this._startAngle;
        }
        if (state === AnimationStateEnum.disappear) {
          return this._endAngle;
        }
        const outState = [AnimationStateEnum.disappear, AnimationStateEnum.exit];
        const markElements = this._pieMark.getGraphics();
        const data = datum;
        const dataIndex = data?.[DEFAULT_DATA_INDEX];
        // 当前 mark 在上个状态是否处于第一个
        if (markElements.find(e => e.context.data[0]?.[DEFAULT_DATA_INDEX] < dataIndex) === undefined) {
          return this._startAngle;
        }
        // 当前 mark 在上个状态是否处于最后一个
        if (markElements.find(e => e.context.data[0]?.[DEFAULT_DATA_INDEX] > dataIndex) === undefined) {
          return this._endAngle;
        }
        // 扇形不在边缘时，获取扇形生长点：获取相邻状态下相邻扇形的边缘
        const prevMarkElement = [...markElements]
          .reverse()
          .find(e => e.context.data[0]?.[DEFAULT_DATA_INDEX] < dataIndex);
        if (outState.includes(state)) {
          return prevMarkElement?.getFinalAttribute()?.endAngle;
        }
        return (prevMarkElement?.attribute as any)?.endAngle;
      }
    };
    const appearPreset = (this._spec.animationAppear as IStateAnimateSpec<PieAppearPreset>)?.preset;
    if (this._pieMark) {
      const pieAnimationConfig = animationConfig(
        Factory.getAnimationInKey('pie')?.(animationParams, appearPreset),
        userAnimationConfig(SeriesMarkNameEnum.pie, this._spec, this._markAttributeContext)
      );
      if (pieAnimationConfig.normal && (pieAnimationConfig.normal as TypeAnimationConfig).type) {
        pieAnimationConfig.normal = centerOffsetConfig(
          this._pieMark,
          pieAnimationConfig.normal as IAnimationTypeConfig
        );
      }
      this._pieMark.setAnimationConfig(pieAnimationConfig);
    }
    if (this._emptyArcMark) {
      const pieAnimationConfig = animationConfig(
        Factory.getAnimationInKey('emptyCircle')?.(animationParams, appearPreset ?? 'fadeIn')
      );
      this._emptyArcMark.setAnimationConfig(pieAnimationConfig);
    }
  }

  getDefaultShapeType() {
    return 'circle';
  }

  getGroupFields(): string[] {
    // do nothing
    return [];
  }

  getStackGroupFields(): string[] {
    // do nothing
    return [];
  }

  getStackValueField(): string {
    // do nothing
    return '';
  }

  // make sure this function fast
  protected _noAnimationDataKey(datum: Datum, index: number) {
    return index;
  }

  getActiveMarks(): IMark[] {
    return [this._pieMark];
  }
}

export class PieSeries<T extends IPieSeriesSpec = IPieSeriesSpec> extends BasePieSeries<T> implements IArcSeries {
  static readonly type: string = SeriesTypeEnum.pie;
  type = SeriesTypeEnum.pie;
}

export const registerPieSeries = () => {
  registerArcMark();
  registerPieAnimation();
  registerEmptyCircleAnimation();
  Factory.registerSeries(PieSeries.type, PieSeries);
};
