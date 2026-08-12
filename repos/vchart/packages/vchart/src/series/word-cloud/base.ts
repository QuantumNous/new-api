/* eslint-disable no-duplicate-imports */
import type { IPadding } from '@visactor/vutils';
import { isNil, isObject, isValidNumber } from '@visactor/vutils';
import { isValid } from '@visactor/vutils';
import { DEFAULT_DATA_INDEX, DEFAULT_DATA_KEY, DEFAULT_DATA_SERIES_FIELD } from '../../constant/data';
import { AttributeLevel } from '../../constant/attribute';
import type { SeriesMarkMap } from '../interface';
import { SeriesMarkNameEnum } from '../interface/type';
import { isTrueBrowser } from '../../util/env';
import {
  DEFAULT_DRAW_OUT_OF_BOUND,
  DEFAULT_FONTSIZE_RANGE,
  DEFAULT_FONT_PADDING,
  DEFAULT_FONT_WEIGHT_RANGE,
  DEFAULT_MASK_SHAPE,
  DEFAULT_MIN_FONT_SIZE,
  DEFAULT_RANDOM,
  DEFAULT_ROTATE_ANGLES,
  DEFAULT_ZOOM_TO_FIT,
  SHAPE_TYPE
} from './config';
import type {
  IWordCloudSeriesSpec,
  IWordCloudSeriesTheme,
  WordCloudConfigType,
  WordCloudShapeConfigType,
  WordCloudShapeType
} from './interface';
import { WordMeasureCache } from './measure-cache';
import type { Datum, IMarkSpec, IPoint, ITextMarkSpec } from '../../typings';
import { animationConfig, userAnimationConfig } from '../../animation/utils';
import { WORD_CLOUD_TEXT } from '../../constant/word-cloud';
import { BaseSeries } from '../base/base-series';
import { ColorOrdinalScale } from '../../scale/color-ordinal-scale';
import { wordCloudSeriesMark } from './constant';
import type { IStateAnimateSpec } from '../../animation/spec';
import { Factory } from '../../core/factory';
import type { IMark, IRectMark, ITextMark } from '../../mark/interface';
import { LinearScale } from '@visactor/vscale';
import type { GeometricMaskShape, TextShapeMask } from '@visactor/vlayouts';
import type { ITransformSpec } from '../../compile/interface';
import { vglobal, getTextBounds, createImage } from '@visactor/vrender-core';
import { wordCloud } from '../../theme/builtin/common/series/word-cloud';
import { LayoutZIndex } from '../../constant/layout';
import { ChartEvent } from '../../core';

export type IBaseWordCloudSeriesSpec = Omit<IWordCloudSeriesSpec, 'type'> & { type: string };

export class BaseWordCloudSeries<T extends IBaseWordCloudSeriesSpec = IBaseWordCloudSeriesSpec> extends BaseSeries<T> {
  static readonly mark: SeriesMarkMap = wordCloudSeriesMark;
  static readonly builtInTheme: Record<string, IWordCloudSeriesTheme> = { wordCloud };

  protected _nameField: string;
  protected _valueField?: string;
  setValueField(field: string) {
    if (isValid(field)) {
      this._valueField = field;
    }
  }

  protected _colorMode: 'linear' | 'ordinal';
  protected _colorList: string[];
  protected _rotateAngles?: number[];
  protected _fontWeightRange?: [number, number];
  protected _textField?: string;
  protected _maskCanvas?: HTMLCanvasElement;
  protected _maskMark?: IRectMark;

  protected _fontSizeRange?: [number, number] | 'auto' = [DEFAULT_MIN_FONT_SIZE, DEFAULT_MIN_FONT_SIZE];
  setFontSizeRange(fontSizeRange: [number, number] | 'auto') {
    if (isValid(fontSizeRange)) {
      this._fontSizeRange = fontSizeRange;
    } else {
      this._fontSizeRange = DEFAULT_FONTSIZE_RANGE;
    }
  }

  protected _maskShape?: string | WordCloudShapeType | TextShapeMask | GeometricMaskShape;
  protected _isWordCloudShape: boolean = false;

  protected _wordCloudConfig?: WordCloudConfigType;
  protected _wordCloudShapeConfig?: WordCloudShapeConfigType;

  private _wordMeasureCache?: WordMeasureCache;

  protected _padding?: IPadding;
  protected _defaultFontFamily: string;

  protected _keyWordColorCallback: (datum: Datum) => string;
  protected _fillingColorCallback: (datum: Datum) => string;
  protected _dataChange: boolean = true;

  protected handleMaskCanvasUpdate = (canvas: HTMLCanvasElement, imageUrl?: string) => {
    this._maskCanvas = canvas;
  };
  /**
   * @override
   */
  setAttrFromSpec() {
    super.setAttrFromSpec();
    // series布局相关
    this._padding = this._option.getChart().padding;

    // 普通词云 & 形状词云 共有spec相关
    this._nameField = this._spec.nameField;
    this._colorMode = this._spec.colorMode ?? 'ordinal';
    this._colorList = this._spec.colorList;
    this.setValueField(this._spec.valueField);
    this._fontWeightRange = this._spec.fontWeightRange ?? DEFAULT_FONT_WEIGHT_RANGE;
    this._rotateAngles = this._spec.rotateAngles ?? DEFAULT_ROTATE_ANGLES;
    this.setFontSizeRange(this._spec.fontSizeRange);
    this._maskShape = this._spec.maskShape ?? DEFAULT_MASK_SHAPE;
    this._textField = this._spec.word?.formatMethod ? WORD_CLOUD_TEXT : this._nameField;
    const wordCloudConfig = this._spec.wordCloudConfig;
    // 普通词云spec相关
    this._wordCloudConfig = {
      drawOutOfBound: DEFAULT_DRAW_OUT_OF_BOUND,
      layoutMode: 'default',
      zoomToFit: DEFAULT_ZOOM_TO_FIT,
      ...this._spec.wordCloudConfig
    };

    if ((!wordCloudConfig || isNil(wordCloudConfig.layoutMode)) && !isTrueBrowser(this._option.mode)) {
      this._wordCloudConfig.layoutMode = 'fast';
    }

    // 形状词云spec相关
    this._wordCloudShapeConfig = {
      fillingSeriesField: this.getSeriesField(),
      fillingRotateAngles: DEFAULT_ROTATE_ANGLES,
      layoutMode: 'default',
      ...this._spec.wordCloudShapeConfig
    };

    this._isWordCloudShape =
      !SHAPE_TYPE.includes(this._maskShape as string) &&
      !['fast', 'grid', 'cloud'].includes(this._wordCloudConfig.layoutMode);
    this._defaultFontFamily = this._option.getTheme('fontFamily') as string;

    if (!this._wordMeasureCache) {
      this._wordMeasureCache = new WordMeasureCache(1000);
    }
  }

  /**
   * @override
   */
  protected initData(): void {
    super.initData();
    // data改变时, 需要重新编译, 重新布局
    this.getViewData()?.target?.addListener('change', () => {
      this._wordMeasureCache?.clear();
      this._dataChange = true;
      this.compile();
    });
  }

  protected _wordMark: ITextMark;

  initMark(): void {
    this._wordMark = this._createMark(
      BaseWordCloudSeries.mark.word,
      {
        key: DEFAULT_DATA_KEY,
        groupKey: this._seriesField,
        isSeriesMark: true
      },
      {
        morphElementKey: this._seriesField
      }
    ) as ITextMark;
    if (this._spec.wordMask?.visible) {
      this._maskMark = this._createMark(BaseWordCloudSeries.mark.wordMask, { dataView: false }) as IRectMark;

      this._maskMark.setMarkConfig({
        zIndex: LayoutZIndex.Mark - 1
      });
    }
  }

  initMarkStyle() {
    this.initMarkStyleOfWord(this._wordMark, this._spec.word, this._spec.colorHexField, this._seriesField);

    if (this._maskMark) {
      this.setMarkStyle(
        this._maskMark,
        {
          width: () => {
            return this._region.getLayoutRect().width;
          },
          height: () => {
            return this._region.getLayoutRect().height;
          },
          background: () => {
            return this._maskCanvas;
          }
        },
        'normal',
        AttributeLevel.Series
      );
    }
  }

  initMarkStyleOfWord(
    wordMark: ITextMark,
    wordSpec?: IMarkSpec<ITextMarkSpec>,
    colorHexField?: string,
    seriesField?: string,
    isFillingWord?: boolean
  ): void {
    if (!wordMark) {
      return;
    }
    this.setMarkStyle(
      wordMark,
      {
        text: (wordSpec as any)?.formatMethod
          ? (datum: Datum) => {
              return (wordSpec as any).formatMethod(datum);
            }
          : (datum: Datum) => datum[this._textField],
        x: (datum: Datum) => datum.x,
        y: (datum: Datum) => datum.y,
        fontSize: (datum: Datum) => datum.fontSize,
        fontStyle: (datum: Datum) => datum.fontStyle,

        angle: (datum: Datum) => datum.angle,
        visible: (datum: Datum) => datum.visible
      },
      'normal',
      AttributeLevel.Series
    );
    this.setMarkStyle(
      wordMark,
      {
        fill: wordSpec?.style?.fill ?? this.getWordColor,
        // style和field相关的配置都已经传给vgrammar, 所以这里直接拿结果就可以
        fontWeight: (datum: Datum) => datum.fontWeight,
        fontFamily: (datum: Datum) => datum.fontFamily
      },
      'normal',
      AttributeLevel.User_Mark
    );
  }

  protected initTooltip() {
    super.initTooltip();

    this._wordMark && this._tooltipHelper.activeTriggerSet.mark.add(this._wordMark);
  }

  initAnimation() {
    [this._wordMark].forEach(mark => {
      if (mark) {
        const appearPreset = (this._spec?.animationAppear as IStateAnimateSpec<any>)?.preset;
        const params = {
          animationConfig: () => mark.getAnimationConfig()?.appear?.[0]
        };
        mark.setAnimationConfig(
          animationConfig(
            Factory.getAnimationInKey('wordCloud')(params, appearPreset),
            userAnimationConfig(SeriesMarkNameEnum.word, this._spec, this._markAttributeContext)
          )
        );
      }
    });
  }

  protected getWordOrdinalColorScale(field: string, isFillingWord: boolean) {
    const colorList = isFillingWord ? this._wordCloudShapeConfig.fillingColorList : this._colorList;
    const colorDomain = field ? this.getViewData()?.latestData.map((datum: Datum) => datum[field]) : [];
    const colorRange = colorList ?? this._option.globalScale.getScale('color')?.range() ?? this._getDataScheme();
    return new ColorOrdinalScale().domain(colorDomain).range?.(colorRange);
  }

  protected initColorCallback(field: string, isFillingWord: boolean) {
    if (this._colorMode === 'ordinal') {
      const scale = this.getWordOrdinalColorScale(field, isFillingWord);
      return (datum: Datum) => {
        return scale.scale(datum[field ?? DEFAULT_DATA_SERIES_FIELD]);
      };
    }

    const colorList =
      (isFillingWord ? this._colorList : this._wordCloudShapeConfig.fillingColorList) ??
      this._option.globalScale.getScale('color').range();

    if (colorList.length === 1) {
      return (datum: Datum) => colorList[0];
    }

    if (this._valueField) {
      const stats = this.getRawDataStatisticsByField(this._valueField, true);
      if (stats.min === stats.max) {
        return colorList[0];
      }
      const scale = new LinearScale().domain([stats.min, stats.max]).range(colorList);

      return (datum: Datum) => {
        return scale.scale(datum[this._valueField]);
      };
    }

    const scale = new LinearScale().domain([0, this.getViewData()?.latestData?.length ?? 1]).range(colorList);

    return (datum: Datum) => {
      return scale.scale(datum[DEFAULT_DATA_INDEX]);
    };
  }

  getWordColor = (datum: Datum) => {
    if (datum.isFillingWord) {
      if (!this._fillingColorCallback || this._dataChange) {
        // 如果updateData数据变更了, 颜色映射也需要重新计算
        this._fillingColorCallback = this._wordCloudShapeConfig.fillingColorHexField
          ? (datum: Datum) => datum[this._wordCloudShapeConfig.fillingColorHexField]
          : this.initColorCallback(this._wordCloudShapeConfig.fillingSeriesField, true);
      }

      return this._fillingColorCallback(datum);
    }

    if (!this._keyWordColorCallback || this._dataChange) {
      // 如果updateData数据变更了, 颜色映射也需要重新计算
      this._keyWordColorCallback = this._spec.colorHexField
        ? datum => datum[this._spec.colorHexField]
        : this.initColorCallback(this._seriesField, false);
    }

    return this._keyWordColorCallback(datum);
  };

  private _calculateFontWeight = (datum: Datum) => {
    const stats = this.getRawDataStatisticsByField(this._valueField, true);

    if (stats.min === stats.max) {
      return this._fontWeightRange[0];
    }

    return (
      this._fontWeightRange[0] +
      ((this._fontWeightRange[this._fontWeightRange.length - 1] - this._fontWeightRange[0]) *
        (datum[this._valueField] - stats.min)) /
        (stats.max - stats.min)
    );
  };

  compile(): void {
    super.compile();
    const { width, height } = this._region.getLayoutRect();
    // 非正常尺寸下不进行布局
    if (!isValidNumber(width) || !isValidNumber(height) || !(height > 0 && width > 0)) {
      return;
    }

    const wordCloudTransforms: ITransformSpec[] = [];

    // 词云 transform
    if (!this._isWordCloudShape) {
      wordCloudTransforms.push({
        type: 'wordcloud',
        ...this._wordCloudTransformOption()
      });
    }
    // 形状词云 transform
    else {
      wordCloudTransforms.push({
        type: 'wordcloudShape',
        // 形状词云中必须要传入dataIndexKey, 否则填充词无法绘制
        ...this._wordCloudShapeTransformOption()
      });
    }

    // 挂到mark的transform上
    this._wordMark.setTransform(wordCloudTransforms);
  }

  protected _getCommonTransformOptions(): any {
    const { width, height } = this._region.getLayoutRect();
    const wordSpec = this._spec.word ?? {};
    const wordStyleSpec = wordSpec.style ?? {};

    return {
      size: [width, height],
      shape:
        isObject(this._maskShape) &&
        (this._maskShape as TextShapeMask).type === 'text' &&
        isNil((this._maskShape as TextShapeMask).fontFamily)
          ? {
              fontFamily: this._option.getTheme('fontFamily'),
              ...this._maskShape
            }
          : this._maskShape,
      onUpdateMaskCanvas: this.handleMaskCanvasUpdate,
      onLayoutFinished: () => {
        const afterWordcloudShapeDraw = () => {
          // 需要等到真正渲染完成
          this._option.globalInstance.getStage().hooks.afterRender.taps = this._option.globalInstance
            .getStage()
            .hooks.afterRender.taps.filter(tap => tap.fn !== afterWordcloudShapeDraw);

          this._option.dispatchEvent?.(ChartEvent.afterWordcloudShapeDraw, {
            instance: this._option.globalInstance
          });
          this._option.globalInstance
            .getChart()
            .getOption()
            .performanceHook?.afterWordcloudShapeDraw?.(this._option.globalInstance);
        };
        this._option.globalInstance.getStage().hooks.afterRender.taps.push({
          type: 'sync',
          name: 'afterWordcloudShapeDraw',
          fn: afterWordcloudShapeDraw
        });
      },
      dataIndexKey: DEFAULT_DATA_KEY,
      text: wordSpec.formatMethod
        ? (datum: Datum) => {
            return wordSpec.formatMethod(datum);
          }
        : { field: this._textField },
      fontSize: this._valueField ? { field: this._valueField } : this._fontSizeRange[0],
      fontSizeRange: this._fontSizeRange === 'auto' ? null : this._fontSizeRange,

      padding: this._spec.word?.padding ?? DEFAULT_FONT_PADDING,
      fontFamily: isValid(this._spec.fontFamilyField)
        ? { field: this._spec.fontFamilyField }
        : wordStyleSpec.fontFamily ?? this._defaultFontFamily,
      // 为了保持和旧版逻辑一致，优先级如下： spec field > mark style > default (根据valueField映射)
      fontWeight: isValid(this._spec.fontWeightField)
        ? { field: this._spec.fontWeightField }
        : isValid(wordStyleSpec.fontWeight)
        ? wordStyleSpec.fontWeight
        : isValid(this._valueField)
        ? this._calculateFontWeight
        : 'normal',
      fontStyle: isValid(this._spec.fontStyleField) ? { field: this._spec.fontStyleField } : wordStyleSpec.fontStyle,
      createCanvas: vglobal.createCanvas.bind(vglobal),
      getTextBounds
    };
  }

  protected _wordCloudTransformOption(): Object {
    const wordCloudConfig = this._wordCloudConfig ?? {};

    return {
      ...wordCloudConfig,
      ...this._getCommonTransformOptions(),
      // TIP: 非浏览器环境下，使用 fast 布局，否则会出现兼容问题
      layoutType: this._wordCloudConfig.layoutMode,

      rotate: this._rotateAngles,

      randomVisible: this._spec.random ?? DEFAULT_RANDOM,
      clip: this._wordCloudConfig.drawOutOfBound === 'clip',
      shrink: this._wordCloudConfig.zoomToFit.shrink,
      enlarge: this._wordCloudConfig.zoomToFit.enlarge,
      minFontSize: this._wordCloudConfig.zoomToFit.fontSizeLimitMin,
      progressiveTime: this._wordCloudConfig.progressiveTime,
      progressiveStep: this._wordCloudConfig.progressiveStep,
      repeatFill: this._wordCloudConfig.zoomToFit.repeat
    };
  }

  protected _wordCloudShapeTransformOption(): Object {
    const fillingWordStyleSpec = this._spec.fillingWord?.style ?? {};
    const wordCloudShapeConfig = this._wordCloudShapeConfig ?? {};

    return {
      ...wordCloudShapeConfig,
      ...this._getCommonTransformOptions(),
      createImage,
      measureCache: this._wordMeasureCache,

      rotateList: this._rotateAngles,
      fillingRotateList: wordCloudShapeConfig.fillingRotateAngles,

      fillingFontFamily: isValid(wordCloudShapeConfig.fillingFontFamilyField)
        ? { field: wordCloudShapeConfig.fillingFontFamilyField }
        : fillingWordStyleSpec.fontFamily ?? this._defaultFontFamily,
      fillingPadding: this._spec.fillingWord?.padding ?? DEFAULT_FONT_PADDING,
      fillingFontStyle: isValid(wordCloudShapeConfig.fillingFontStyleField)
        ? { field: wordCloudShapeConfig.fillingFontStyleField }
        : fillingWordStyleSpec.fontStyle,
      // 如果配置了字段映射，优先按照映射进行展示
      fillingFontWeight: isValid(wordCloudShapeConfig.fillingFontWeightField)
        ? {
            field: wordCloudShapeConfig.fillingFontWeightField
          }
        : fillingWordStyleSpec.fontWeight // 填充词fontWeight默认不跟随valueField
    };
  }

  getStatisticFields() {
    const fields: { key: string; operations: Array<'max' | 'min' | 'values'> }[] = [];
    fields.push({ key: this._nameField, operations: ['values'] });
    fields.push({ key: this._valueField, operations: ['max', 'min'] });
    return fields;
  }
  dataToPosition(data: Datum): IPoint {
    return null;
  }
  dataToPositionX(data: any): number {
    return null;
  }
  dataToPositionY(data: any): number {
    return null;
  }
  dataToPositionZ(data: any): number {
    return null;
  }
  valueToPosition(value1: any, value2?: any): IPoint {
    return null;
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

  onLayoutEnd(): void {
    super.onLayoutEnd();
    this.compile();
    this._dataChange = false;
  }

  getActiveMarks(): IMark[] {
    return [this._wordMark];
  }

  reInit() {
    super.reInit();
    if (this._keyWordColorCallback) {
      this._keyWordColorCallback = null;
    }

    if (this._fillingColorCallback) {
      this._fillingColorCallback = null;
    }

    this._wordMeasureCache?.clear();
  }

  release() {
    super.release();
    this._wordMeasureCache?.clear();
    this._wordMeasureCache = undefined;
  }
}
