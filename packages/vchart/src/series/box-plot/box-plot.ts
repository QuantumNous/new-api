/* eslint-disable no-duplicate-imports */
import { AttributeLevel } from '../../constant/attribute';
import { DEFAULT_DATA_INDEX } from '../../constant/data';
import { PREFIX } from '../../constant/base';
import type { IModelEvaluateOption, IModelInitOption } from '../../model/interface';
import type { BoxPlotShaftShape, IOutlierMarkSpec, Datum, DirectionType } from '../../typings';
import { Direction } from '../../typings/space';
import { valueInScaleRange } from '../../util/scale';
import { CartesianSeries } from '../cartesian/cartesian';
import type { SeriesMarkMap } from '../interface';
import { SeriesMarkNameEnum, SeriesTypeEnum } from '../interface/type';
import type { IBoxPlotSeriesSpec } from './interface';
import { STATE_VALUE_ENUM } from '../../compile/mark/interface';
import { registerDataSetInstanceTransform } from '../../data/register';
import { DataView } from '@visactor/vdataset';
import { foldOutlierData } from '../../data/transforms/box-plot';
import { BOX_PLOT_OUTLIER_VALUE_FIELD } from '../../constant/box-plot';
import { BoxPlotSeriesTooltipHelper } from './tooltip-helper';
import { addVChartProperty } from '../../data/transforms/add-property';
import { addDataKey, initKeyMap } from '../../data/transforms/data-key';
import { animationConfig, userAnimationConfig } from '../../animation/utils';
import { registerScaleInOutAnimation } from '../../animation/config';
import type { IMarkAnimateSpec } from '../../animation/spec';
import { registerBoxPlotMark } from '../../mark/box-plot';
import { registerSymbolMark } from '../../mark/symbol';
import { boxPlotSeriesMark } from './constant';
import { Factory } from '../../core/factory';
import type { IBoxPlotMark, IGlyphMark, IMark, ISymbolMark, ITextMark } from '../../mark/interface';
import { merge, isNumber, isValid, isNil, array, last } from '@visactor/vutils';
import { getGroupAnimationParams } from '../util/utils';
import { registerCartesianLinearAxis, registerCartesianBandAxis } from '../../component/axis/cartesian';
import type { ICompilableData } from '../../compile/data';
import { CompilableData } from '../../compile/data';
import { registeBoxPlotScaleAnimation } from './animation';
import { boxPlot } from '../../theme/builtin/common/series/box-plot';
import { getActualNumValue } from '../../util/space';
import { isContinuous } from '@visactor/vscale';
import { BoxPlotSeriesSpecTransformer } from './box-plot-transformer';
import type { ISeriesSpecUpdatePolicy } from '../base/base-series';

const DEFAULT_STROKE_WIDTH = 2;
const DEFAULT_SHAFT_FILL_OPACITY = 0.5;
const DEFAULT_SHAFT_SHAPE = 'line';
export const DEFAULT_FILL_COLOR = '#FFF';
export const DEFAULT_STROKE_COLOR = '#000';

const DEFAULT_OUTLIER_SIZE = 10;

type BoxPlotSeriesCompileOnlyKey = 'boxWidth' | 'boxMinWidth' | 'boxMaxWidth' | 'boxGapInGroup';

const BOX_PLOT_SERIES_COMPILE_ONLY_KEYS: Record<BoxPlotSeriesCompileOnlyKey, true> = {
  boxWidth: true,
  boxMinWidth: true,
  boxMaxWidth: true,
  boxGapInGroup: true
};

export class BoxPlotSeries<T extends IBoxPlotSeriesSpec = IBoxPlotSeriesSpec> extends CartesianSeries<T> {
  static readonly type: string = SeriesTypeEnum.boxPlot;
  type = SeriesTypeEnum.boxPlot;

  static readonly builtInTheme = { boxPlot };
  static readonly mark: SeriesMarkMap = boxPlotSeriesMark;

  static readonly transformerConstructor = BoxPlotSeriesSpecTransformer as any;
  readonly transformerConstructor = BoxPlotSeriesSpecTransformer;

  protected _bandPosition = 0;
  protected _minField: string;
  getMinField() {
    return this._minField;
  }
  protected _maxField: string;
  getMaxField() {
    return this._maxField;
  }
  protected _q1Field: string;
  getQ1Field() {
    return this._q1Field;
  }
  protected _medianField: string;
  getMedianField() {
    return this._medianField;
  }
  protected _q3Field: string;
  getQ3Field() {
    return this._q3Field;
  }
  protected _outliersField: string;
  getOutliersField() {
    return this._outliersField;
  }
  protected _lineWidth: number;
  protected _boxWidth: number;
  protected _shaftShape: BoxPlotShaftShape;
  getShaftShape() {
    return this._shaftShape;
  }
  protected _shaftWidth: number;
  protected _boxFillColor: string;
  getBoxFillColor() {
    return this._boxFillColor;
  }
  protected _strokeColor: string;
  getStrokeColor() {
    return this._strokeColor;
  }
  protected _shaftFillOpacity: number;
  protected _outliersStyle: IOutlierMarkSpec;
  getOutliersStyle() {
    return this._outliersStyle;
  }
  protected _outlierData: ICompilableData;

  private _autoBoxWidth: number;

  protected _getSpecUpdatePolicy(): ISeriesSpecUpdatePolicy {
    const policy = super._getSpecUpdatePolicy();
    return {
      ...policy,
      compileOnlyKeys: {
        ...policy.compileOnlyKeys,
        ...BOX_PLOT_SERIES_COMPILE_ONLY_KEYS
      }
    };
  }

  /**
   * @override
   */
  setAttrFromSpec() {
    super.setAttrFromSpec();
    const boxPlotStyle: any = this._spec.boxPlot?.style ?? {};
    this._minField = this._spec.minField;
    this._maxField = this._spec.maxField;
    this._q1Field = this._spec.q1Field;
    this._medianField = this._spec.medianField;
    this._q3Field = this._spec.q3Field;
    this._outliersField = this._spec.outliersField;
    this._lineWidth = boxPlotStyle.lineWidth ?? DEFAULT_STROKE_WIDTH;
    this._boxWidth = boxPlotStyle.boxWidth;
    this._shaftShape = boxPlotStyle.shaftShape ?? DEFAULT_SHAFT_SHAPE;
    this._shaftWidth = boxPlotStyle.shaftWidth;
    this._boxFillColor = boxPlotStyle.boxFill;
    this._strokeColor = boxPlotStyle.stroke;

    this._shaftFillOpacity =
      this._shaftShape === 'bar' ? boxPlotStyle.shaftFillOpacity ?? DEFAULT_SHAFT_FILL_OPACITY : undefined;

    this._outliersStyle = (this._spec.outliersStyle ?? this._spec.outlier?.style) as IOutlierMarkSpec;
  }

  private _boxPlotMark?: IBoxPlotMark;
  private _outlierMark?: ISymbolMark;

  initMark(): void {
    this._boxPlotMark = this._createMark(BoxPlotSeries.mark.boxPlot, {
      groupKey: this._seriesField,
      isSeriesMark: true
    }) as IBoxPlotMark;
    if (this._outliersField) {
      this._outlierMark = this._createMark(BoxPlotSeries.mark.outlier, {
        key: DEFAULT_DATA_INDEX,
        groupKey: this._seriesField
      }) as ISymbolMark;

      this._outlierMark.setData(this._outlierData);
    }
  }

  initMarkStyle(): void {
    const boxPlotMark = this._boxPlotMark;
    if (boxPlotMark) {
      const commonBoxplotStyles = {
        lineWidth: this._lineWidth,
        fill: this._boxFillColor ?? (this._shaftShape !== 'line' ? this.getColorAttribute() : DEFAULT_FILL_COLOR),
        minMaxFillOpacity: this._shaftFillOpacity,
        stroke: this._strokeColor ?? (this._shaftShape !== 'line' ? DEFAULT_STROKE_COLOR : this.getColorAttribute())
      };

      (boxPlotMark as IGlyphMark).setGlyphConfig({
        direction: this._direction,
        shaftShape: this._shaftShape
      });

      const boxPlotMarkStyles =
        this._direction === Direction.horizontal
          ? {
              y: (datum: Datum) => this._getPosition(this.direction, datum),
              boxHeight: () => getActualNumValue(this._boxWidth ?? '100%', this._getMarkWidth()),
              ruleHeight: () => getActualNumValue(this._shaftWidth ?? '100%', this._getMarkWidth()),
              q1q3Height: () => getActualNumValue(this._boxWidth ?? '100%', this._getMarkWidth()),
              minMaxHeight: () => getActualNumValue(this._shaftWidth ?? '100%', this._getMarkWidth())
            }
          : {
              x: (datum: Datum) => this._getPosition(this.direction, datum),
              boxWidth: () => getActualNumValue(this._boxWidth ?? '100%', this._getMarkWidth()),
              ruleWidth: () => getActualNumValue(this._shaftWidth ?? '100%', this._getMarkWidth()),
              q1q3Width: () => getActualNumValue(this._boxWidth ?? '100%', this._getMarkWidth()),
              minMaxWidth: () => getActualNumValue(this._shaftWidth ?? '100%', this._getMarkWidth())
            };

      this.setMarkStyle(boxPlotMark, commonBoxplotStyles, STATE_VALUE_ENUM.STATE_NORMAL, AttributeLevel.Series);
      this.setMarkStyle(boxPlotMark, boxPlotMarkStyles, STATE_VALUE_ENUM.STATE_NORMAL, AttributeLevel.Built_In);
    }

    const outlierMark = this._outlierMark;
    if (outlierMark) {
      this.setMarkStyle(
        outlierMark,
        {
          fill: this._outliersStyle?.fill ?? this._boxFillColor ?? this.getColorAttribute(),
          stroke: this.getColorAttribute(),
          size: isNumber(this._outliersStyle?.size) ? this._outliersStyle.size : DEFAULT_OUTLIER_SIZE
        },
        STATE_VALUE_ENUM.STATE_NORMAL,
        AttributeLevel.Series
      );
    }

    this.initBoxPlotMarkStyle();
  }

  initBoxPlotMarkStyle(): void {
    const boxPlotMark = this._boxPlotMark;
    const axisHelper = this._direction === Direction.horizontal ? this._xAxisHelper : this._yAxisHelper;
    if (boxPlotMark && axisHelper) {
      const { dataToPosition } = axisHelper;
      const scale = axisHelper?.getScale?.(0);
      this.setMarkStyle(
        boxPlotMark,
        {
          min: (datum: Datum) =>
            valueInScaleRange(
              dataToPosition(this.getDatumPositionValues(datum, this._minField), {
                bandPosition: this._bandPosition
              }),
              scale
            ),
          q1: (datum: Datum) =>
            valueInScaleRange(
              dataToPosition(this.getDatumPositionValues(datum, this._q1Field), {
                bandPosition: this._bandPosition
              }),
              scale
            ),
          median: (datum: Datum) =>
            valueInScaleRange(
              dataToPosition(this.getDatumPositionValues(datum, this._medianField), {
                bandPosition: this._bandPosition
              }),
              scale
            ),
          q3: (datum: Datum) =>
            valueInScaleRange(
              dataToPosition(this.getDatumPositionValues(datum, this._q3Field), {
                bandPosition: this._bandPosition
              }),
              scale
            ),
          max: (datum: Datum) =>
            valueInScaleRange(
              dataToPosition(this.getDatumPositionValues(datum, this._maxField), {
                bandPosition: this._bandPosition
              }),
              scale
            )
        },
        STATE_VALUE_ENUM.STATE_NORMAL,
        AttributeLevel.Series
      );
    }
    const outlierMark = this._outlierMark;
    if (outlierMark && axisHelper) {
      const { dataToPosition } = axisHelper;
      const scale = axisHelper?.getScale?.(0);
      const outlierMarkPositionChannel =
        this._direction === Direction.horizontal
          ? {
              y: (datum: Datum) => this._getPosition(this.direction, datum),
              x: (datum: Datum) =>
                valueInScaleRange(
                  dataToPosition(this.getDatumPositionValues(datum, BOX_PLOT_OUTLIER_VALUE_FIELD), {
                    bandPosition: this._bandPosition
                  }),
                  scale
                )
            }
          : {
              x: (datum: Datum) => this._getPosition(this.direction, datum),
              y: (datum: Datum) =>
                valueInScaleRange(
                  dataToPosition(this.getDatumPositionValues(datum, BOX_PLOT_OUTLIER_VALUE_FIELD), {
                    bandPosition: this._bandPosition
                  }),
                  scale
                )
            };
      this.setMarkStyle(outlierMark, outlierMarkPositionChannel, STATE_VALUE_ENUM.STATE_NORMAL, AttributeLevel.Series);
    }
  }

  initLabelMarkStyle(textMark: ITextMark) {
    if (!textMark) {
      return;
    }
    this.setMarkStyle(textMark, {
      fill: this.getColorAttribute(),
      text: (datum: Datum) => {
        return datum[this.getMedianField()];
      },
      z: this._fieldZ ? this.dataToPositionZ.bind(this) : null
    });
  }

  initData(): void {
    super.initData();
    if (!this._data) {
      return;
    }

    registerDataSetInstanceTransform(this._dataSet, 'foldOutlierData', foldOutlierData);
    registerDataSetInstanceTransform(this._dataSet, 'addVChartProperty', addVChartProperty);

    const outlierDataView = new DataView(this._dataSet, { name: `${this.type}_outlier_${this.id}_data` });
    outlierDataView.parse([this.getViewData()], {
      type: 'dataview'
    });
    outlierDataView.name = `${PREFIX}_series_${this.id}_outlierData`;
    outlierDataView.transform({
      type: 'foldOutlierData',
      options: () => ({
        dimensionField: this._direction === Direction.horizontal ? this._fieldY : this._fieldX,
        outliersField: this._outliersField,
        seriesField: this._seriesField
      })
    });

    outlierDataView.transform(
      {
        type: 'addVChartProperty',
        options: {
          beforeCall: initKeyMap.bind(this),
          call: addDataKey
        }
      },
      false
    );

    this._outlierData = new CompilableData(this._option, outlierDataView);
  }

  compileData() {
    super.compileData();
    this._outlierData?.compile();
  }

  viewDataUpdate(d: DataView): void {
    super.viewDataUpdate(d);
    this._outlierData?.updateData();
  }

  init(option: IModelInitOption): void {
    super.init(option);
    //init在axis初始化之后才被执行，此时axisHelper不为空
    this.initBoxPlotMarkStyle();
  }

  private _getMarkWidth() {
    if (this._autoBoxWidth) {
      return this._autoBoxWidth;
    }
    //获取自适应的图元宽度
    const bandAxisHelper = this._direction === Direction.horizontal ? this._yAxisHelper : this._xAxisHelper;
    const depthFromSpec = this._groups ? this._groups.fields.length : 1;
    const bandWidth = bandAxisHelper.getBandwidth?.(depthFromSpec - 1) ?? Math.max(this._boxWidth, this._shaftWidth);

    let width = bandWidth;
    if (isValid(this._spec.boxWidth)) {
      width = getActualNumValue(this._spec.boxWidth, bandWidth);
    }
    if (isValid(this._spec.boxMinWidth)) {
      width = Math.max(width, getActualNumValue(this._spec.boxMinWidth, bandWidth));
    }
    if (isValid(this._spec.boxMaxWidth)) {
      width = Math.min(width, getActualNumValue(this._spec.boxMaxWidth, bandWidth));
    }

    this._autoBoxWidth = width;

    return this._autoBoxWidth;
  }

  protected _getPosition(direction: DirectionType, datum: Datum) {
    let axisHelper;
    let sizeAttribute;
    let dataToPosition;
    if (direction === Direction.horizontal) {
      axisHelper = this.getYAxisHelper();
      sizeAttribute = 'boxHeight';
      dataToPosition = this.dataToPositionY.bind(this);
    } else {
      axisHelper = this.getXAxisHelper();
      sizeAttribute = 'boxWidth';
      dataToPosition = this.dataToPositionX.bind(this);
    }
    const scale = axisHelper.getScale(0);

    const depthFromSpec = this._groups ? this._groups.fields.length : 1;
    const depth = depthFromSpec;

    const bandWidth = axisHelper.getBandwidth?.(depth - 1) ?? Math.max(this._boxWidth, this._shaftWidth);
    const size = this._boxPlotMark.getAttribute(sizeAttribute, datum) as number;

    if (depth > 1 && isValid(this._spec.boxGapInGroup)) {
      // 自里向外计算，沿着第一层分组的中心点进行位置调整
      const groupFields = this._groups.fields;
      const boxGapInGroup = array(this._spec.boxGapInGroup);
      let totalWidth: number = 0;
      let offSet: number = 0;

      for (let index = groupFields.length - 1; index >= 1; index--) {
        const groupField = groupFields[index];
        // const groupValues = this.getViewDataStatistics()?.latestData?.[groupField]?.values ?? [];
        const groupValues = axisHelper.getScale(index)?.domain() ?? [];
        const groupCount = groupValues.length;
        const gap = getActualNumValue(boxGapInGroup[index - 1] ?? last(boxGapInGroup), bandWidth);
        const i = groupValues.indexOf(datum[groupField]);
        if (index === groupFields.length - 1) {
          totalWidth += groupCount * size + (groupCount - 1) * gap;
          offSet += i * (size + gap);
        } else {
          offSet += i * (totalWidth + gap);
          totalWidth += totalWidth + (groupCount - 1) * gap;
        }
      }

      const center =
        scale.scale(datum[groupFields[0]]) +
        (axisHelper.getBandwidth(0) ?? Math.max(this._boxWidth, this._shaftWidth)) / 2;
      return center - totalWidth / 2 + offSet + size / 2;
    }

    const continuous = isContinuous(scale.type || 'band');
    const pos = dataToPosition(datum);

    return pos + bandWidth * 0.5 + (continuous ? -bandWidth / 2 : 0);
  }

  onLayoutEnd() {
    super.onLayoutEnd();
    //每次布局结束，清除自适应宽度缓存
    this._autoBoxWidth = null;
  }

  private _initAnimationSpec(config: any = {}) {
    //将spec中的animation的type替换为箱型图的type
    const newConfig = merge({}, config);
    ['appear', 'enter', 'update', 'exit', 'disappear'].forEach(state => {
      if (newConfig[state] && newConfig[state].type === 'scaleIn') {
        newConfig[state].type = this._shaftShape === 'bar' ? 'barBoxplotScaleIn' : 'boxplotScaleIn';
      } else if (newConfig[state] && newConfig[state].type === 'scaleOut') {
        newConfig[state].type = this._shaftShape === 'bar' ? 'barBoxplotScaleOut' : 'boxplotScaleOut';
      }
    });
    return newConfig;
  }

  initAnimation() {
    const animationParams = getGroupAnimationParams(this);

    if (this._boxPlotMark) {
      const newDefaultConfig = this._initAnimationSpec(Factory.getAnimationInKey('scaleInOut')?.());
      const newConfig = this._initAnimationSpec(
        userAnimationConfig(SeriesMarkNameEnum.boxPlot, this._spec, this._markAttributeContext)
      );
      this._boxPlotMark.setAnimationConfig(animationConfig(newDefaultConfig, newConfig, animationParams));
    }

    if (this._outlierMark) {
      const outlierMarkUserAnimation = {
        appear: (this._spec.animationAppear as IMarkAnimateSpec<string>)?.symbol,
        disappear: (this._spec.animationDisappear as IMarkAnimateSpec<string>)?.symbol,
        enter: (this._spec.animationEnter as IMarkAnimateSpec<string>)?.symbol,
        exit: (this._spec.animationExit as IMarkAnimateSpec<string>)?.symbol,
        update: (this._spec.animationUpdate as IMarkAnimateSpec<string>)?.symbol
      };
      this._outlierMark.setAnimationConfig(
        animationConfig(Factory.getAnimationInKey('scaleInOut')?.(), outlierMarkUserAnimation, animationParams)
      );
    }
  }

  protected initTooltip() {
    this._tooltipHelper = new BoxPlotSeriesTooltipHelper(this);
    this._boxPlotMark && this._tooltipHelper.activeTriggerSet.mark.add(this._boxPlotMark);
    this._outlierMark && this._tooltipHelper.activeTriggerSet.mark.add(this._outlierMark);
  }

  getStatisticFields() {
    const fields = super.getStatisticFields();
    const outliersField = fields.find(f => f.key === this._outliersField);
    if (outliersField) {
      outliersField.operations = ['array-min', 'array-max'];
    }
    return fields;
  }

  getDefaultShapeType(): string {
    return 'square';
  }

  getActiveMarks(): IMark[] {
    return [this._boxPlotMark];
  }
}

export const registerBoxplotSeries = () => {
  registerBoxPlotMark();
  registerSymbolMark();
  registerScaleInOutAnimation();
  registerCartesianBandAxis();
  registerCartesianLinearAxis();
  registeBoxPlotScaleAnimation();
  Factory.registerSeries(BoxPlotSeries.type, BoxPlotSeries);
};
