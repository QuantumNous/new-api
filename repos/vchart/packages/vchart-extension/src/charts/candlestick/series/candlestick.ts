import type { ICandlestickMark } from '../mark/candlestick';
import { registerCandlestickMark } from '../mark/candlestick';
import type { IMark, Datum, IModelInitOption } from '@visactor/vchart';
import {
  registerSymbolMark,
  registerScaleInOutAnimation,
  registerCartesianBandAxis,
  registerCartesianLinearAxis,
  CartesianSeries,
  Factory,
  STATE_VALUE_ENUM,
  AttributeLevel,
  getGroupAnimationParams,
  animationConfig,
  userAnimationConfig
} from '@visactor/vchart';
import { valueInScaleRange } from '@visactor/vchart';
import type { IGlyphMark } from '@visactor/vchart';
import { merge } from '@visactor/vchart';
import type { ICandlestickSeriesSpec } from './interface';
import { registerCandlestickScaleAnimation } from './animation';
import { CANDLESTICK_SERIES_TYPE, CandlestickSeriesMark } from './constant';
import { CandlestickSeriesTooltipHelper } from './tooltip-helper';
import { candlestick } from './theme';

export const DEFAULT_STROKE_COLOR = '#000';
export class CandlestickSeries<T extends ICandlestickSeriesSpec = ICandlestickSeriesSpec> extends CartesianSeries<T> {
  static readonly type: string = CANDLESTICK_SERIES_TYPE;
  type = CANDLESTICK_SERIES_TYPE;

  static readonly builtInTheme = { candlestick };
  static readonly mark = CandlestickSeriesMark;
  protected _openField: string;
  getOpenField(): string {
    return this._openField;
  }
  protected _highField: string;
  getHighField(): string {
    return this._highField;
  }
  protected _lowField: string;
  getLowField(): string {
    return this._lowField;
  }
  protected _closeField: string;
  getCloseField(): string {
    return this._closeField;
  }
  protected _boxWidth: number;
  protected _boxFill: string | ((datum: Datum) => string);
  getBoxFill(): string | ((datum: Datum) => string) {
    return this._boxFill;
  }
  protected _strokeColor: string;
  getStrokeColor(): string {
    return this._strokeColor;
  }
  private _autoBoxWidth: number;
  private _mergedStyles: { rising: any; falling: any; doji: any } = {
    rising: {},
    falling: {},
    doji: {}
  };

  setAttrFromSpec() {
    super.setAttrFromSpec();
    const spec = this._spec;
    const CandlestickStyle: any = spec.candlestick?.style ?? {};
    this._openField = spec.openField;
    this._highField = spec.highField;
    this._lowField = spec.lowField;
    this._closeField = spec.closeField;
    this._boxWidth = CandlestickStyle.boxWidth;
    this._boxFill = CandlestickStyle.boxFill;
    this._strokeColor = CandlestickStyle.strokeColor;
    this._buildMergedStyles(
      CandlestickStyle,
      spec.rising?.style ?? {},
      spec.falling?.style ?? {},
      spec.doji?.style ?? {}
    );
  }

  private _candlestickMark?: ICandlestickMark;

  initMark(): void {
    this._candlestickMark = this._createMark(CandlestickSeries.mark.candlestick, {
      groupKey: this._seriesField,
      isSeriesMark: true
    }) as ICandlestickMark;
  }

  initMarkStyle(): void {
    const candlestickMark = this._candlestickMark;
    if (candlestickMark) {
      const CandlestickStyles = {
        fill: (datum: Datum) => {
          const boxFill = this.mergeStyle(datum).boxFill;
          return boxFill;
        },
        stroke: (datum: Datum) => {
          const strokeColor = this.mergeStyle(datum).stroke;
          return strokeColor;
        },
        lineWidth: (datum: Datum) => {
          const lineWidth = this.mergeStyle(datum).lineWidth;
          return lineWidth;
        },
        boxWidth: this._boxWidth ?? this._getMarkWidth.bind(this),
        x: this.dataToPositionX.bind(this)
      };
      (candlestickMark as IGlyphMark).setGlyphConfig({});
      this.setMarkStyle(candlestickMark, CandlestickStyles, STATE_VALUE_ENUM.STATE_NORMAL, AttributeLevel.Series);
    }
  }

  initCandlestickMarkStyle() {
    const candlestickMark = this._candlestickMark;
    const axisHelper = this._yAxisHelper;
    if (candlestickMark && axisHelper) {
      const { dataToPosition } = axisHelper;
      const scale = axisHelper?.getScale?.(0);
      this.setMarkStyle(
        candlestickMark,
        {
          open: (datum: Datum) =>
            valueInScaleRange(
              dataToPosition(this.getDatumPositionValues(datum, this._openField), {
                bandPosition: this._bandPosition
              }),
              scale
            ),
          high: (datum: Datum) =>
            valueInScaleRange(
              dataToPosition(this.getDatumPositionValues(datum, this._highField), {
                bandPosition: this._bandPosition
              }),
              scale
            ),
          low: (datum: Datum) =>
            valueInScaleRange(
              dataToPosition(this.getDatumPositionValues(datum, this._lowField), {
                bandPosition: this._bandPosition
              }),
              scale
            ),
          close: (datum: Datum) =>
            valueInScaleRange(
              dataToPosition(this.getDatumPositionValues(datum, this._closeField), {
                bandPosition: this._bandPosition
              }),
              scale
            )
        },
        STATE_VALUE_ENUM.STATE_NORMAL,
        AttributeLevel.Series
      );
    }
  }

  init(option: IModelInitOption): void {
    super.init(option);
    //init在axis初始化之后才被执行，此时axisHelper不为空
    this.initCandlestickMarkStyle();
  }

  private _initAnimationSpec(config: any = {}) {
    const newConfig = merge({}, config);
    ['appear', 'enter', 'update', 'exit', 'disappear'].forEach(state => {
      if (newConfig[state] && newConfig[state].type === 'scaleIn') {
        newConfig[state].type = 'candlestickScaleIn';
      } else if (newConfig[state] && newConfig[state].type === 'scaleOut') {
        newConfig[state].type = 'candlestickScaleOut';
      }
    });
    return newConfig;
  }

  initAnimation() {
    const animationParams = getGroupAnimationParams(this);

    if (this._candlestickMark) {
      const newDefaultConfig = this._initAnimationSpec(Factory.getAnimationInKey('scaleInOut')?.());
      const newConfig = this._initAnimationSpec(
        userAnimationConfig(CANDLESTICK_SERIES_TYPE, this._spec, this._markAttributeContext)
      );
      this._candlestickMark.setAnimationConfig(animationConfig(newDefaultConfig, newConfig, animationParams));
    }
  }

  protected initTooltip() {
    this._tooltipHelper = new CandlestickSeriesTooltipHelper(this);
    this._candlestickMark && this._tooltipHelper.activeTriggerSet.mark.add(this._candlestickMark);
  }

  private _buildMergedStyles(baseStyle: any, risingStyle: any, fallingStyle: any, dojiStyle: any) {
    this._mergedStyles.rising = merge({}, baseStyle, risingStyle);
    this._mergedStyles.falling = merge({}, baseStyle, fallingStyle);
    this._mergedStyles.doji = merge({}, baseStyle, dojiStyle);
  }

  protected mergeStyle(datum: Datum): any {
    const open = this.getDatumPositionValues(datum, this._openField)[0];
    const close = this.getDatumPositionValues(datum, this._closeField)[0];
    if (open < close) {
      return this._mergedStyles.rising;
    } else if (open > close) {
      return this._mergedStyles.falling;
    }
    return this._mergedStyles.doji;
  }

  private _getMarkWidth() {
    if (this._autoBoxWidth) {
      return this._autoBoxWidth;
    }
    //获取自适应的图元宽度
    const bandAxisHelper = this._xAxisHelper;
    const xField = this._fieldX;

    const innerBandWidth = bandAxisHelper.getBandwidth(xField.length - 1);
    const autoBoxWidth = innerBandWidth / xField.length;
    this._autoBoxWidth = autoBoxWidth;

    return this._autoBoxWidth;
  }

  onLayoutEnd() {
    super.onLayoutEnd();
    this._autoBoxWidth = null;
  }

  getActiveMarks(): IMark[] {
    return [this._candlestickMark];
  }
}

export const registerCandlestickSeries = () => {
  registerCandlestickMark();
  registerSymbolMark();
  registerScaleInOutAnimation();
  registerCartesianBandAxis();
  registerCartesianLinearAxis();
  registerCandlestickScaleAnimation();
  Factory.registerSeries(CandlestickSeries.type, CandlestickSeries);
};
