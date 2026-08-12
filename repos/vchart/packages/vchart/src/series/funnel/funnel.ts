/* eslint-disable no-duplicate-imports */
import type { IFunnelSeries, SeriesMarkMap } from '../interface';
import { SeriesMarkNameEnum } from '../interface/type';
import type { IOrientType, IPoint, TextAlign, TextBaseLine, Datum, StringOrNumber } from '../../typings';
import { SeriesTypeEnum } from '../interface/type';
import { BaseSeries } from '../base/base-series';
import { AttributeLevel } from '../../constant/attribute';
import { DEFAULT_DATA_KEY } from '../../constant/data';
import { PREFIX } from '../../constant/base';
import { registerDataSetInstanceTransform } from '../../data/register';
import { DataView } from '@visactor/vdataset';
import type { ILabelMark, IMark, IMarkGraphic, IPolygonMark, IRuleMark, ITextMark } from '../../mark/interface';
import { MarkTypeEnum } from '../../mark/interface/type';
import type { IFunnelOpt } from '../../data/transforms/funnel';
import { funnel, funnelTransform } from '../../data/transforms/funnel';
import {
  FUNNEL_CURRENT_VALUE,
  FUNNEL_HEIGHT_RATIO,
  FUNNEL_LABEL_LINE_LENGTH,
  FUNNEL_LABEL_SPACE_WIDTH,
  FUNNEL_LAST_VALUE,
  FUNNEL_LAST_VALUE_RATIO,
  FUNNEL_MAX_SIZE,
  FUNNEL_MIN_SIZE,
  FUNNEL_NEXT_VALUE,
  FUNNEL_NEXT_VALUE_RATIO,
  FUNNEL_REACH_RATIO,
  FUNNEL_TRANSFORM_LEVEL,
  FUNNEL_TRANSFORM_RATIO,
  FUNNEL_VALUE_RATIO
} from '../../constant/funnel';
import { calcLayoutNumber } from '../../util/space';
import { field } from '../../util/object';
import type { FunnelAppearPreset, IFunnelSeriesSpec, IFunnelSeriesTheme } from './interface';
import { FunnelSeriesTooltipHelper } from './tooltip-helper';
import { isFunction, isValid, isNumber } from '@visactor/vutils';
import {
  FadeInOutAnimation,
  registerCartesianGroupClipAnimation,
  registerFadeInOutAnimation
} from '../../animation/config';
import { animationConfig, shouldMarkDoMorph, userAnimationConfig } from '../../animation/utils';
import type { IStateAnimateSpec } from '../../animation/spec';
import { registerPolygonMark } from '../../mark/polygon/polygon';
import { registerTextMark } from '../../mark/text';
import { registerRuleMark } from '../../mark/rule';
import { funnelSeriesMark } from './constant';
import type { LabelItem } from '@visactor/vrender-components';
import { Factory } from '../../core/factory';
import { FunnelSeriesSpecTransformer } from './funnel-transformer';
import type { ICompilableData } from '../../compile/data';
import { CompilableData } from '../../compile/data';
import { moveAfterInArray } from '../../util/array';
import { funnel as funnelTheme } from '../../theme/builtin/common/series/funnel';

export class FunnelSeries<T extends IFunnelSeriesSpec = IFunnelSeriesSpec>
  extends BaseSeries<T>
  implements IFunnelSeries
{
  static readonly type: string = SeriesTypeEnum.funnel;
  type: string = SeriesTypeEnum.funnel;
  protected _funnelMarkName: string = SeriesMarkNameEnum.funnel;
  protected _funnelMarkType: string = MarkTypeEnum.polygon;
  protected _transformMarkName: string = SeriesMarkNameEnum.transform;
  protected _transformMarkType: string = MarkTypeEnum.polygon;

  static readonly mark: SeriesMarkMap = funnelSeriesMark;
  static readonly builtInTheme: Record<string, IFunnelSeriesTheme> = { funnel: funnelTheme };
  static readonly transformerConstructor = FunnelSeriesSpecTransformer as any;
  readonly transformerConstructor = FunnelSeriesSpecTransformer;

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

  protected _viewDataTransform!: ICompilableData;

  protected _funnelAlign: 'left' | 'center' | 'right' | 'top' | 'bottom';
  protected _funnelOrient: IOrientType;
  protected _shape: 'rect' | 'trapezoid';

  protected _funnelMark: IPolygonMark | null = null;
  protected _funnelTransformMark: IPolygonMark | null = null;
  protected _labelMark: ILabelMark | null = null;
  protected _transformLabelMark: ILabelMark | null = null;
  protected _funnelOuterLabelMark: { label?: ITextMark; line?: IRuleMark } = {};

  protected _minLabelLineWidth: number;

  setAttrFromSpec(): void {
    super.setAttrFromSpec();

    this.setCategoryField(this._spec.categoryField);
    this.setValueField(this._spec.valueField);

    this._funnelOrient = this._spec.funnelOrient ?? 'top';
    this._shape = this._spec.shape ?? 'trapezoid';
    this._minLabelLineWidth = this._spec.outerLabel?.line?.minLength ?? FUNNEL_LABEL_LINE_LENGTH;

    if (this._isHorizontal()) {
      this._funnelAlign = ['top', 'bottom'].includes(this._spec.funnelAlign) ? this._spec.funnelAlign : 'center';
    } else {
      this._funnelAlign = ['left', 'right'].includes(this._spec.funnelAlign) ? this._spec.funnelAlign : 'center';
    }

    if (!this._seriesField && this._spec.categoryField) {
      this.setSeriesField(this._spec.categoryField);
    }
  }

  initData() {
    super.initData();
    if (!this._data) {
      return;
    }

    registerDataSetInstanceTransform(this._dataSet, 'funnel', funnel);
    registerDataSetInstanceTransform(this._dataSet, 'funnelTransform', funnelTransform);

    const viewDataTransform = new DataView(this._dataSet, { name: `${PREFIX}_series_${this.id}_viewDataTransform` });
    viewDataTransform.parse([this.getViewData()], {
      type: 'dataview'
    });

    this._viewDataTransform = new CompilableData(this._option, viewDataTransform);
  }

  compile() {
    super.compile();

    if (this._funnelOuterLabelMark) {
      this._funnelOuterLabelMark.label?.compile({
        group: this._rootMark.getProduct()
      });
      this._funnelOuterLabelMark.line?.compile({
        group: this._rootMark.getProduct()
      });
    }
  }

  compileData() {
    super.compileData();
    this._viewDataTransform?.compile();
  }

  getStatisticFields() {
    const fields: { key: string; operations: Array<'max' | 'min' | 'values'> }[] = [];
    fields.push({ key: this._categoryField, operations: ['values'] });
    fields.push({ key: this._valueField, operations: ['max', 'min'] });
    return fields;
  }

  protected _statisticViewData(): void {
    super._statisticViewData();
    this._data.getDataView().transform({
      type: 'funnel',
      options: {
        valueField: () => this.getValueField(),
        isCone: () => this._spec.isCone,
        // heightVisual: true,
        asCurrentValue: FUNNEL_CURRENT_VALUE,
        asTransformRatio: FUNNEL_TRANSFORM_RATIO,
        asReachRatio: FUNNEL_REACH_RATIO,
        asHeightRatio: FUNNEL_HEIGHT_RATIO,
        asValueRatio: FUNNEL_VALUE_RATIO,
        asNextValueRatio: FUNNEL_NEXT_VALUE_RATIO,
        asLastValueRatio: FUNNEL_LAST_VALUE_RATIO,
        asLastValue: FUNNEL_LAST_VALUE,
        asNextValue: FUNNEL_NEXT_VALUE,
        range: () => this._spec.range
      } as IFunnelOpt
    });

    this._viewDataTransform.getDataView()?.transform({
      type: 'funnelTransform',
      options: { asIsTransformLevel: FUNNEL_TRANSFORM_LEVEL }
    });
  }

  initMark() {
    this._funnelMark = this._createMark(
      {
        ...FunnelSeries.mark.funnel,
        name: this._funnelMarkName,
        type: this._funnelMarkType
      },
      {
        themeSpec: this._theme?.funnel,
        groupKey: this._seriesField,
        isSeriesMark: true,
        noSeparateStyle: true
      },
      {
        morph: shouldMarkDoMorph(this._spec, this._funnelMarkName),
        morphElementKey: this._seriesField
      }
    ) as IPolygonMark;

    if (this._spec.isTransform) {
      this._funnelTransformMark = this._createMark(
        {
          ...FunnelSeries.mark.transform,
          name: this._transformMarkName,
          type: this._transformMarkType
        },
        {
          themeSpec: this._theme?.transform,
          noSeparateStyle: true
        }
      );
      if (this._funnelTransformMark) {
        this._funnelTransformMark.setData(this._viewDataTransform);
      }
    }

    if (this._spec?.outerLabel?.visible) {
      const { line } = this._spec.outerLabel ?? {};
      const { line: lineTheme } = this._theme?.outerLabel ?? {};

      this._funnelOuterLabelMark.label = this._createMark(FunnelSeries.mark.outerLabel, {
        themeSpec: this._theme?.outerLabel,
        markSpec: this._spec.outerLabel,
        noSeparateStyle: true,
        parent: false
      }) as ITextMark;
      this._funnelOuterLabelMark.line = this._createMark(FunnelSeries.mark.outerLabelLine, {
        themeSpec: lineTheme,
        markSpec: line,
        noSeparateStyle: true,
        parent: false
      }) as IRuleMark;
    }
  }

  protected initTooltip() {
    this._tooltipHelper = new FunnelSeriesTooltipHelper(this);
    this._funnelMark && this._tooltipHelper.activeTriggerSet.mark.add(this._funnelMark);
    this._funnelTransformMark && this._tooltipHelper.activeTriggerSet.mark.add(this._funnelTransformMark);
  }

  getDimensionField(): string[] {
    return this._seriesField ? [this._seriesField] : [];
  }
  getMeasureField(): string[] {
    return [this._valueField];
  }

  getGroupFields(): string[] {
    return null;
  }

  initMarkStyle() {
    const funnelMark = this._funnelMark;
    if (funnelMark) {
      this.setMarkStyle(
        funnelMark,
        {
          points: (datum: Datum) => this.getPoints(datum),
          visible: (datum: Datum) => isValid(datum[this._valueField]),
          fill: this.getColorAttribute()
        },
        'normal',
        AttributeLevel.Series
      );
    }

    const funnelTransformMark = this._funnelTransformMark;
    if (funnelTransformMark) {
      this.setMarkStyle(
        funnelTransformMark,
        { points: (datum: Datum) => this.getPoints(datum) },
        'normal',
        AttributeLevel.Series
      );
    }

    const outerLabelMark = this._funnelOuterLabelMark.label;
    if (outerLabelMark) {
      this.setMarkStyle(
        outerLabelMark,
        {
          text: (datum: Datum) => `${datum[this.getCategoryField()]}`,
          x: (datum: Datum) => this._computeOuterLabelPosition(datum).x,
          y: (datum: Datum) => this._computeOuterLabelPosition(datum).y,
          textAlign: (datum: Datum) => this._computeOuterLabelPosition(datum).align,
          textBaseline: (datum: Datum) => this._computeOuterLabelPosition(datum).textBaseline,
          maxLineWidth: (datum: Datum) => this._computeOuterLabelLimit(datum),
          /** 不设置 width/height 会导致 richtext 有默认宽高, case: richtext-bounds */
          /** width 和 height 对 text 标签不影响 */
          width: 0,
          height: 0
        },
        'normal',
        AttributeLevel.Series
      );
      if (isFunction(this._spec.outerLabel.formatMethod)) {
        this.setMarkStyle(
          outerLabelMark,
          {
            text: (datum: Datum) => {
              return this._spec.outerLabel.formatMethod(`${datum[this.getCategoryField()]}`, datum) as any;
            }
          },
          'normal',
          AttributeLevel.User_Mark
        );
      }
    }
    const outerLabelLineMark = this._funnelOuterLabelMark.line;
    if (outerLabelLineMark && outerLabelMark) {
      this.setMarkStyle(
        outerLabelLineMark,
        {
          x: (datum: Datum) => this._computeOuterLabelLinePosition(datum).x1,
          y: (datum: Datum) => this._computeOuterLabelLinePosition(datum).y1,
          x1: (datum: Datum) => this._computeOuterLabelLinePosition(datum).x2,
          y1: (datum: Datum) => this._computeOuterLabelLinePosition(datum).y2
        },
        'normal',
        AttributeLevel.Series
      );
      const visible = this._spec.outerLabel?.line?.visible ?? this._spec.outerLabel?.visible;
      if (isValid(visible)) {
        outerLabelLineMark.setVisible(visible);
      }
    }
  }

  initLabelMarkStyle(labelMark?: ILabelMark) {
    if (!labelMark) {
      return;
    }

    const target = labelMark.getTarget();
    const component = labelMark.getComponent();

    if (target === this._funnelMark) {
      this._labelMark = labelMark;
      this.setMarkStyle(
        labelMark,
        {
          text: (datum: Datum) => `${datum[this.getCategoryField()]} ${datum[this.getValueField()]}`,
          x: (datum: Datum) => this._computeLabelPosition(datum).x,
          y: (datum: Datum) => this._computeLabelPosition(datum).y,
          maxLineWidth: (datum: Datum) => this._computeLabelLimit(datum, this._spec.label),
          stroke: this.getColorAttribute()
        },
        'normal',
        AttributeLevel.Series
      );

      const rootMarks = this.getCompiler().getRootMarks();

      // 调整在rootMarks中的顺序，这个会影响最终渲染的顺序
      if (this._funnelOuterLabelMark.label) {
        moveAfterInArray(rootMarks, this._funnelOuterLabelMark.label, component);
      }
      if (this._funnelOuterLabelMark.line) {
        moveAfterInArray(rootMarks, this._funnelOuterLabelMark.line, this._funnelOuterLabelMark.label ?? component);
      }
      // component.model.event.on(HOOK_EVENT.AFTER_ELEMENT_ENCODE, this.handleLabelComponentUpdate);
    } else if (this._funnelTransformMark && target === this._funnelTransformMark) {
      this._transformLabelMark = labelMark;
      this.setMarkStyle(
        labelMark,
        {
          text: (datum: Datum) => {
            const ratio = field(FUNNEL_REACH_RATIO).bind(this)(datum) as number;
            return `${(ratio * 100).toFixed(1)}%`;
          },
          x: (datum: Datum) => this._computeLabelPosition(datum).x,
          y: (datum: Datum) => this._computeLabelPosition(datum).y,
          maxLineWidth: (datum: Datum) => this._computeLabelLimit(datum, this._spec.transformLabel)
        },
        'normal',
        AttributeLevel.Series
      );
    }
  }

  initAnimation() {
    const appearPreset = (this._spec?.animationAppear as IStateAnimateSpec<FunnelAppearPreset>)?.preset ?? 'clipIn';
    if (appearPreset === 'clipIn') {
      if (this._rootMark) {
        this._rootMark.setAnimationConfig(
          animationConfig(
            Factory.getAnimationInKey('cartesianGroupClip')?.(
              {
                direction: () => (this._isHorizontal() ? 'x' : 'y'),
                width: () => {
                  const rootMark = this.getRootMark().getProduct();
                  if (rootMark) {
                    const { x1, x2 } = rootMark.AABBBounds;
                    return Math.max(x1, x2); // rootMark.x === 0, so need to find largest bound x instead of bounds width
                  }
                  return this.getLayoutRect().width;
                },
                height: () => {
                  const rootMark = this.getRootMark().getProduct();
                  if (rootMark) {
                    const { y1, y2 } = rootMark.AABBBounds;
                    return Math.max(y1, y2);
                  }
                  return this.getLayoutRect().height;
                },
                orient: () => (this._isReverse() ? 'negative' : 'positive')
              },
              appearPreset
            ),
            userAnimationConfig(SeriesMarkNameEnum.group, this._spec, this._markAttributeContext)
          )
        );
      }
    }
    [this._funnelOuterLabelMark?.label].forEach(m => {
      if (m) {
        m.setAnimationConfig(
          animationConfig(
            Factory.getAnimationInKey('fadeInOut')(),
            userAnimationConfig(m.name, this._spec, this._markAttributeContext)
          )
        );
      }
    });

    [this._funnelMark, this._funnelTransformMark].forEach(m => {
      if (m) {
        m.setAnimationConfig(
          animationConfig(
            Factory.getAnimationInKey('funnel')({}, appearPreset),
            userAnimationConfig(m.name, this._spec, this._markAttributeContext)
          )
        );
      }
    });

    if (this._funnelOuterLabelMark?.line) {
      this._funnelOuterLabelMark.line.setAnimationConfig(
        animationConfig(
          Factory.getAnimationInKey('fadeInOut')?.(),
          userAnimationConfig(SeriesMarkNameEnum.outerLabelLine, this._spec, this._markAttributeContext)
        )
      );
    }
  }
  // hack group
  initGroups() {
    // do nothing
  }

  // handle stack
  getStackGroupFields(): string[] {
    return [];
  }

  getStackValueField(): string {
    // hack
    return null;
  }

  /** event */
  protected initEvent() {
    super.initEvent();
    // 同步更新转化层数据
    this._viewDataTransform.getDataView()?.target.addListener('change', (d: DataView) => {
      this._viewDataTransform.updateData();
    });
  }

  /**
   *
   *   P0 ----------- P1       P2 ------ P3
   *      \         /           /        \
   *     P3 ------ P2        P1 ---------- P0
   *
   *         P1                     P0
   *           |\ P2           P3 /|
   *           | |               | |
   *           |/ P3           P2 \|
   *         P0                     P1
   */
  getPoints(datum: Datum) {
    // 对特殊数据层不进行绘制
    const isTransformLevel = this.isTransformLevel(datum);

    const heightHalf = this._getMainAxisLength(isTransformLevel) / 2;
    let upperLeft;
    let lowerLeft;
    if (isTransformLevel) {
      upperLeft =
        this._shape === 'rect'
          ? this._getSecondaryAxisLength(datum[FUNNEL_LAST_VALUE_RATIO]) / 2
          : this._getSecondaryAxisLength(datum[FUNNEL_VALUE_RATIO]) / 2;
      lowerLeft = this._getSecondaryAxisLength(datum[FUNNEL_VALUE_RATIO]) / 2;
    } else {
      upperLeft = this._getSecondaryAxisLength(datum[FUNNEL_VALUE_RATIO]) / 2;
      lowerLeft = this._shape === 'rect' ? upperLeft : this._getSecondaryAxisLength(datum[FUNNEL_NEXT_VALUE_RATIO]) / 2;
    }

    const { x, y } = this._getPositionByData(datum);

    const points = this._getPolygonPoints([x, y], upperLeft, lowerLeft, upperLeft, lowerLeft, heightHalf);

    if (this._funnelAlign !== 'center') {
      this._adjustPoints(points);
    }
    return points;
  }

  isTransformLevel(datum: Datum) {
    return !!datum?.[FUNNEL_TRANSFORM_LEVEL];
  }

  protected _buildMarkAttributeContext() {
    super._buildMarkAttributeContext();
    this._markAttributeContext.valueToPosition = this.valueToPosition.bind(this);
    this._markAttributeContext.getPoints = this.getPoints.bind(this);
    this._markAttributeContext.isTransformLevel = this.isTransformLevel.bind(this);
  }

  valueToPosition(category: StringOrNumber) {
    const innerDatum = this.getViewData()?.latestData?.find?.((d: Datum) => d[this._categoryField] === category);
    if (!isValid(innerDatum)) {
      return null;
    }
    return this._getPolygonCenter(this.getPoints(innerDatum));
  }

  dataToPosition(datum: any, checkInViewData?: boolean) {
    if (checkInViewData && !this.isDatumInViewData(datum)) {
      return null;
    }
    return this.valueToPosition(datum[this._categoryField]);
  }

  dataToPositionX(datum: any) {
    return this.dataToPosition(datum)?.x;
  }

  dataToPositionY(datum: any) {
    return this.dataToPosition(datum)?.y;
  }

  dataToPositionZ(datum: any) {
    return 0;
  }

  private _getMainAxisLength(isTransform = false) {
    const funnelCount = this.getViewData().latestData.length;
    const viewHeight = this._isHorizontal() ? this.getLayoutRect().width : this.getLayoutRect().height;

    const hasTransform = !!this._spec.isTransform;
    const gap = hasTransform ? 0 : this._spec.gap ?? 0;
    const transformCount = hasTransform ? Math.max(0, funnelCount - 1) : 0;
    const heightRatio = this._spec.heightRatio || 0.5;
    const funnelHeight =
      (viewHeight - gap * Math.max(0, funnelCount - 1)) / (funnelCount + heightRatio * transformCount);
    if (isTransform) {
      return hasTransform ? funnelHeight * heightRatio : 0;
    }
    return funnelHeight;
  }

  private _getSecondaryAxisLength(ratio: number) {
    const validRatio = Number.isNaN(ratio) || !Number.isFinite(ratio) ? 0 : ratio;
    const maxSize = this._computeMaxSize();
    const minSize = this._computeMinSize();
    return minSize + (maxSize - minSize) * validRatio;
  }

  /**
   * 根据数据计算主轴中心点
   * @param datum
   * @returns
   */
  private _getPositionByData(datum: Datum) {
    const index = this.getViewData().latestData?.findIndex(
      (d: Datum) =>
        d[this._categoryField] === datum[this._categoryField] && d[DEFAULT_DATA_KEY] === datum[DEFAULT_DATA_KEY]
    );
    if (!isValid(index) || index < 0) {
      return {};
    }
    const isTransform = this.isTransformLevel(datum);
    const isHorizontal = this._isHorizontal();
    const viewWidth = isHorizontal ? this.getLayoutRect().height : this.getLayoutRect().width;
    const viewHeight = isHorizontal ? this.getLayoutRect().width : this.getLayoutRect().height;
    const centerX = viewWidth / 2;

    let centerY = 0;
    const funnelHeight = this._getMainAxisLength();
    const transformHeight = this._getMainAxisLength(true);
    const offset = funnelHeight + transformHeight;

    centerY += index * offset;
    centerY += isTransform ? -transformHeight / 2 : funnelHeight / 2;
    if (!this._spec.isTransform && this._spec.gap) {
      centerY += this._spec.gap * index;
    }

    this._isReverse() && (centerY = viewHeight - centerY);

    return this._isHorizontal() ? { x: centerY, y: centerX } : { x: centerX, y: centerY };
  }

  private _getPolygonPoints(
    center: [number, number],
    upperLeft: number,
    lowerLeft: number,
    upperRight: number,
    lowerRight: number,
    heightHalf: number
  ) {
    const x = center[0];
    const y = center[1];
    switch (this._funnelOrient) {
      case 'left':
        return [
          { x: x - heightHalf, y: y + upperLeft },
          { x: x - heightHalf, y: y - upperRight },
          { x: x + heightHalf, y: y - lowerRight },
          { x: x + heightHalf, y: y + lowerLeft }
        ];
      case 'right':
        return [
          { x: x + heightHalf, y: y - upperRight },
          { x: x + heightHalf, y: y + upperRight },
          { x: x - heightHalf, y: y + lowerLeft },
          { x: x - heightHalf, y: y - lowerLeft }
        ];
      case 'bottom':
        return [
          { x: x + upperLeft, y: y + heightHalf },
          { x: x - upperRight, y: y + heightHalf },
          { x: x - lowerRight, y: y - heightHalf },
          { x: x + lowerLeft, y: y - heightHalf }
        ];
      default:
        // top
        return [
          { x: x - upperLeft, y: y - heightHalf },
          { x: x + upperRight, y: y - heightHalf },
          { x: x + lowerRight, y: y + heightHalf },
          { x: x - lowerLeft, y: y + heightHalf }
        ];
    }
  }

  /** 计算梯形中位线的中点
   * @param points
   * @returns
   */
  private _getPolygonCenter(points: IPoint[]) {
    if (this._isHorizontal()) {
      const p0_x = (points[0].x + points[3].x) / 2;
      const p0_y = (points[0].y + points[3].y) / 2;
      const p1_x = (points[1].x + points[2].x) / 2;
      const p1_y = (points[1].y + points[2].y) / 2;
      return {
        x: (p0_x + p1_x) / 2,
        y: (p0_y + p1_y) / 2
      };
    }

    // 梯形中位线坐标
    const p0_x = (points[0].x + points[3].x) / 2;
    const p0_y = (points[0].y + points[3].y) / 2;
    const p1_x = (points[1].x + points[2].x) / 2;
    const p1_y = (points[1].y + points[2].y) / 2;
    return {
      x: (p0_x + p1_x) / 2,
      y: (p0_y + p1_y) / 2
    };
  }

  /**
   * 调整点的偏移量，满足align效果
   * @param points
   * @returns
   */
  private _adjustPoints(points: IPoint[]) {
    let upperOffset;
    let lowerOffset;
    let dirKey;
    if (this._isHorizontal()) {
      dirKey = 'y';
      if (this._funnelOrient === 'left') {
        upperOffset = this._funnelAlign === 'bottom' ? -points[1].y : points[1].y;
        lowerOffset = this._funnelAlign === 'bottom' ? -points[2].y : points[2].y;
      } else {
        upperOffset = this._funnelAlign === 'bottom' ? -points[0].y : points[0].y;
        lowerOffset = this._funnelAlign === 'bottom' ? -points[3].y : points[3].y;
      }
    } else {
      dirKey = 'x';
      if (this._funnelOrient === 'top') {
        upperOffset = this._funnelAlign === 'left' ? points[0].x : -points[0].x;
        lowerOffset = this._funnelAlign === 'left' ? points[3].x : -points[3].x;
      } else {
        upperOffset = this._funnelAlign === 'left' ? points[1].x : -points[1].x;
        lowerOffset = this._funnelAlign === 'left' ? points[2].x : -points[2].x;
      }
    }
    (points[0][dirKey] -= upperOffset), (points[1][dirKey] -= upperOffset);
    (points[2][dirKey] -= lowerOffset), (points[3][dirKey] -= lowerOffset);
    return points;
  }

  private _computeLabelPosition(datum: Datum) {
    const points = this.getPoints(datum);
    return this._getPolygonCenter(points);
  }

  // label 相关
  private _computeLabelLimit(datum: Datum, labelSpec: IFunnelSeriesSpec['label']) {
    const limit = labelSpec?.limit;

    if (isNumber(limit)) {
      return limit;
    }

    const points = this.getPoints(datum);

    if (limit === 'shapeSize') {
      if (this._isHorizontal()) {
        return Math.abs(points[3].x - points[0].x);
      }

      return (Math.abs(points[0].x - points[1].x) + Math.abs(points[2].x - points[3].x)) / 2;
    }

    if (this._isHorizontal()) {
      return Math.abs(points[3].x - points[0].x);
    }

    // return this._computeMaxSize();
    // FIXME: 待 vrender 修复 maxLineWidth 在 bound 计算的 bug 后可以恢复注释
    return undefined;
  }

  private _computeOuterLabelPosition(datum: Datum) {
    let x;
    let y;
    let position: IOrientType = this._spec.outerLabel?.position;
    let textAlign: TextAlign = 'center';
    let textBaseline: TextBaseLine = 'middle';
    if (this._isHorizontal()) {
      position = ['top', 'bottom'].includes(position) ? position : this._funnelAlign === 'bottom' ? 'top' : 'bottom';
    } else {
      position = ['left', 'right'].includes(position) ? position : this._funnelAlign === 'left' ? 'right' : 'left';
    }

    if (this._spec.outerLabel?.alignLabel !== false) {
      ({ x, y } = this._getPositionByData(datum));
      if (position === 'left') {
        (x = 0), (textAlign = 'left');
      } else if (position === 'right') {
        (x = this.getLayoutRect().width), (textAlign = 'right');
      } else if (position === 'top') {
        (y = 0), (textBaseline = 'top');
      } else if (position === 'bottom') {
        (y = this.getLayoutRect().height), (textBaseline = 'bottom');
      }
    } else {
      const { x2, y2 } = this._computeOuterLabelLinePosition(datum);
      (x = x2), (y = y2);
      if (position === 'left') {
        (x -= FUNNEL_LABEL_SPACE_WIDTH), (textAlign = 'right');
      } else if (position === 'right') {
        (x += FUNNEL_LABEL_SPACE_WIDTH), (textAlign = 'left');
      } else if (position === 'top') {
        (y -= FUNNEL_LABEL_SPACE_WIDTH), (textBaseline = 'bottom');
      } else if (position === 'bottom') {
        (y += FUNNEL_LABEL_SPACE_WIDTH), (textBaseline = 'top');
      }
    }
    return { x, y, align: textAlign, textBaseline };
  }

  private _computeOuterLabelLimit(datum: Datum) {
    if (this._isHorizontal()) {
      return this._getMainAxisLength(this.isTransformLevel(datum));
    }

    // 垂直方向上的limit计算逻辑
    const points = this.getPoints(datum);
    const shapeMiddleWidth = (Math.abs(points[0].x - points[1].x) + Math.abs(points[2].x - points[3].x)) / 2;
    const categoryField = this.getCategoryField();

    const funnelLabelBounds = (this._labelMark?.getComponent()?.getComponent() as any)?.find(
      ({ attribute, type }: { attribute: LabelItem; type: string }) => {
        return type === 'text' && attribute.data?.[categoryField] === datum[categoryField];
      },
      true
    )?.AABBBounds;

    const funnelLabelWidth = funnelLabelBounds ? funnelLabelBounds.x2 - funnelLabelBounds.x1 : 0;
    const outerLineSpace = this._funnelOuterLabelMark.line ? this._minLabelLineWidth : 0;

    let space = this.getLayoutRect().width - Math.max(shapeMiddleWidth, funnelLabelWidth);
    if (this._funnelAlign === 'center') {
      space /= 2;
    }
    return space - outerLineSpace - (this._spec.outerLabel?.spaceWidth ?? FUNNEL_LABEL_SPACE_WIDTH);
  }

  private _computeOuterLabelLinePosition(datum: Datum) {
    const categoryField = this.getCategoryField();
    const outerLabelMarkBounds = this._funnelOuterLabelMark?.label
      ?.getGraphics()
      ?.find((g: IMarkGraphic) => g.context.data[0]?.[categoryField] === datum[categoryField])?.AABBBounds;
    const labelComponent = this._labelMark?.getComponent()?.getComponent();

    const labelMarkBounds = (labelComponent as any)?.find(
      ({ attribute, type }: { attribute: LabelItem; type: string }) => {
        return type === 'text' && attribute.data?.[categoryField] === datum[categoryField];
      },
      true
    )?.AABBBounds;
    const outerLabelSpec = this._spec.outerLabel ?? {};
    let x1;
    let x2;
    let y1;
    let y2;
    if (this._isHorizontal()) {
      const spaceWidth = outerLabelSpec.spaceWidth ?? FUNNEL_LABEL_SPACE_WIDTH;
      const points = this.getPoints(datum);
      const shapeMiddleHeight = (Math.abs(points[0].y - points[1].y) + Math.abs(points[2].y - points[3].y)) / 2;
      if (this._spec.outerLabel.position === 'top' || this._funnelAlign === 'bottom') {
        y1 = this._getPolygonCenter(points).y - shapeMiddleHeight / 2 - spaceWidth;
        y2 = outerLabelSpec.alignLabel !== false ? outerLabelMarkBounds?.y2 + spaceWidth : y1 - spaceWidth;
        x1 = this._getPolygonCenter(points).x;
        y1 - y2 < this._minLabelLineWidth && (y2 = y1 - this._minLabelLineWidth);
        x2 = x1;
      } else {
        y1 = this._getPolygonCenter(points).y + shapeMiddleHeight / 2 + spaceWidth;
        y2 = outerLabelSpec.alignLabel !== false ? outerLabelMarkBounds?.y1 - spaceWidth : y1 + spaceWidth;
        x1 = this._getPolygonCenter(points).x;
        y2 - y1 < this._minLabelLineWidth && (y2 = y1 + this._minLabelLineWidth);
        x2 = x1;
      }
      return { x1, x2, y1, y2 };
    }
    const points = this.getPoints(datum);
    const shapeMiddleWidth = (Math.abs(points[0].x - points[1].x) + Math.abs(points[2].x - points[3].x)) / 2;
    const labelWidth = labelMarkBounds?.x2 - labelMarkBounds?.x1 || 0;

    const spaceWidth = outerLabelSpec.spaceWidth ?? FUNNEL_LABEL_SPACE_WIDTH;
    if (this._spec.outerLabel.position === 'right' || this._funnelAlign === 'left') {
      x1 = this._getPolygonCenter(points).x + Math.max(labelWidth / 2, shapeMiddleWidth / 2) + spaceWidth;
      x2 = outerLabelSpec.alignLabel !== false ? outerLabelMarkBounds?.x1 - spaceWidth : x1 + spaceWidth;
      y1 = this._getPolygonCenter(points).y;
      x2 - x1 < this._minLabelLineWidth && (x2 = x1 + this._minLabelLineWidth);
      y2 = y1;
    } else {
      x1 = this._getPolygonCenter(points).x - Math.max(labelWidth / 2, shapeMiddleWidth / 2) - spaceWidth;
      x2 = outerLabelSpec.alignLabel !== false ? outerLabelMarkBounds?.x2 + spaceWidth : x1 - spaceWidth;
      y1 = this._getPolygonCenter(points).y;
      x1 - x2 < this._minLabelLineWidth && (x2 = x1 - this._minLabelLineWidth);
      y2 = y1;
    }
    return { x1, x2, y1, y2 };
  }

  protected _computeMaxSize() {
    const size = this._isHorizontal() ? this.getLayoutRect().height : this.getLayoutRect().width;
    const maxSize = this._spec.maxSize ?? FUNNEL_MAX_SIZE;
    return calcLayoutNumber(maxSize, size);
  }

  protected _computeMinSize() {
    const size = this._isHorizontal() ? this.getLayoutRect().height : this.getLayoutRect().width;
    const minSize = this._spec.minSize ?? FUNNEL_MIN_SIZE;
    return calcLayoutNumber(minSize, size);
  }

  protected _isHorizontal() {
    return this._funnelOrient === 'left' || this._funnelOrient === 'right';
  }

  private _isReverse() {
    return this._funnelOrient === 'bottom' || this._funnelOrient === 'right';
  }

  getDefaultShapeType(): string {
    return 'square';
  }

  getActiveMarks(): IMark[] {
    return [this._funnelMark];
  }
}

export const registerFunnelSeries = () => {
  registerPolygonMark();
  registerTextMark();
  registerRuleMark();
  Factory.registerSeries(FunnelSeries.type, FunnelSeries);
  Factory.registerAnimation('funnel', (params: any, preset: FunnelAppearPreset) => ({
    appear: preset === 'clipIn' ? undefined : { type: 'fadeIn' },
    ...FadeInOutAnimation
  }));
  registerCartesianGroupClipAnimation();
  registerFadeInOutAnimation();
};
