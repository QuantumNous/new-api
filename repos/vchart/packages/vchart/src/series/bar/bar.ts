/* eslint-disable no-duplicate-imports */
import type { IBaseScale } from '@visactor/vscale';
import { isContinuous } from '@visactor/vscale';
import { Direction } from '../../typings/space';
import { CartesianSeries } from '../cartesian/cartesian';
import type { ISeriesSpecUpdatePolicy } from '../base/base-series';
import type { IMark, IRectMark, ITextMark } from '../../mark/interface';
import { MarkTypeEnum } from '../../mark/interface/type';
import {
  DEFAULT_DATA_KEY,
  STACK_FIELD_END,
  STACK_FIELD_END_PERCENT,
  STACK_FIELD_START,
  STACK_FIELD_START_PERCENT
} from '../../constant/data';
import { AttributeLevel } from '../../constant/attribute';
import type { Datum, DirectionType } from '../../typings';
import { isValueInScaleDomain, valueInScaleRange } from '../../util/scale';
import { getRegionStackGroup } from '../../util/data';
import { getActualNumValue } from '../../util/space';
import { registerBarAnimation } from './animation';
import { animationConfig, shouldMarkDoMorph, userAnimationConfig } from '../../animation/utils';
import type { BarAppearPreset, IBarAnimationParams, IBarSeriesSpec, IBarSeriesTheme } from './interface';
import type { IAxisHelper } from '../../component/axis/cartesian/interface';
import type { IModelInitOption } from '../../model/interface';
import type { SeriesMarkMap } from '../interface';
import { SeriesMarkNameEnum, SeriesTypeEnum } from '../interface/type';
import type { IStateAnimateSpec } from '../../animation/spec';
import { registerRectMark } from '../../mark/rect';
import { array, isFunction, isNil, isValid, last } from '@visactor/vutils';
import { barSeriesMark } from './constant';
import { stackWithMinHeight } from '../util/stack';
import { Factory } from '../../core/factory';
import { registerDataSetInstanceTransform } from '../../data/register';
import { DataView } from '@visactor/vdataset';
import { addVChartProperty } from '../../data/transforms/add-property';
import { addDataKey, initKeyMap } from '../../data/transforms/data-key';
import { getGroupAnimationParams } from '../util/utils';
import { BarSeriesSpecTransformer } from './bar-transformer';
import { ComponentTypeEnum } from '../../component/interface';
import { RECT_X, RECT_X1, RECT_Y, RECT_Y1 } from '../base/constant';
import { createRect } from '@visactor/vrender-core';
import { registerCartesianLinearAxis, registerCartesianBandAxis } from '../../component/axis/cartesian';
import type { ICompilableData } from '../../compile/data';
import { CompilableData } from '../../compile/data';
import { registerDataSamplingTransform } from '../../mark/transform/data-sampling';
import { maxInArr, minInArr } from '../../util/array';
import { bar } from '../../theme/builtin/common/series/bar';

export const DefaultBandWidth = 6; // 默认的bandWidth，避免连续轴没有bandWidth

type BarSeriesCompileOnlyKey =
  | 'barWidth'
  | 'barMinWidth'
  | 'barMaxWidth'
  | 'barGapInGroup'
  | 'barMinHeight'
  | 'stackCornerRadius';

const BAR_SERIES_COMPILE_ONLY_KEYS: Record<BarSeriesCompileOnlyKey, true> = {
  barWidth: true,
  barMinWidth: true,
  barMaxWidth: true,
  barGapInGroup: true,
  barMinHeight: true,
  stackCornerRadius: true
};

export class BarSeries<T extends IBarSeriesSpec = IBarSeriesSpec> extends CartesianSeries<T> {
  static readonly type: string = SeriesTypeEnum.bar;
  type: string = SeriesTypeEnum.bar;
  protected _barMarkName: string = SeriesMarkNameEnum.bar;
  protected _barMarkType: string = MarkTypeEnum.rect;

  static readonly builtInTheme: Record<string, IBarSeriesTheme> = { bar };
  static readonly mark: SeriesMarkMap = barSeriesMark;
  static readonly transformerConstructor = BarSeriesSpecTransformer as any;
  readonly transformerConstructor = BarSeriesSpecTransformer;

  protected _bandPosition = 0;
  protected _barMark!: IRectMark;
  protected _barBackgroundMark!: IRectMark;

  protected _barBackgroundViewData: ICompilableData;

  protected _getSpecUpdatePolicy(): ISeriesSpecUpdatePolicy {
    const policy = super._getSpecUpdatePolicy();
    return {
      ...policy,
      compileOnlyKeys: {
        ...policy.compileOnlyKeys,
        ...BAR_SERIES_COMPILE_ONLY_KEYS
      }
    };
  }

  initMark(): void {
    this._initBarBackgroundMark();

    this._barMark = this._createMark(
      {
        ...BarSeries.mark.bar,
        name: this._barMarkName,
        type: this._barMarkType
      },
      {
        groupKey: this._seriesField,
        isSeriesMark: true
      },
      {
        morphElementKey: this.getDimensionField()[0],
        morph: shouldMarkDoMorph(this._spec, this._barMarkName)
      }
    ) as IRectMark;
  }

  protected _initBarBackgroundMark(): void {
    if (this._spec.barBackground && this._spec.barBackground.visible) {
      this._barBackgroundMark = this._createMark(BarSeries.mark.barBackground, {
        dataView: this._barBackgroundViewData.getDataView(),
        dataProductId: this._barBackgroundViewData.getProductId()
      }) as IRectMark;
    }
  }

  initMarkStyle(): void {
    if (this._barMark) {
      this.setMarkStyle(
        this._barMark,
        {
          fill: this.getColorAttribute()
        },
        'normal',
        AttributeLevel.Series
      );
    }

    this.initRectMarkStyle();
  }

  protected initRectMarkStyle() {
    if (!this._barMark) {
      return;
    }

    const bandAxisHelper = this.direction === Direction.vertical ? this._xAxisHelper : this._yAxisHelper;
    const scale = bandAxisHelper?.getScale?.(0);
    if (!scale) {
      return;
    }

    scale.type === 'band' ? this.initBandRectMarkStyle() : this.initLinearRectMarkStyle();
  }

  initLabelMarkStyle(textMark: ITextMark) {
    if (!textMark) {
      return;
    }
    this.setMarkStyle(textMark, {
      fill: this.getColorAttribute(),
      text: (datum: Datum) => {
        return datum[this.getStackValueField()];
      },
      z: this._fieldZ ? this.dataToPositionZ.bind(this) : null
    });
  }

  protected initTooltip() {
    super.initTooltip();
    const { mark, group } = this._tooltipHelper.activeTriggerSet;
    if (this._barMark) {
      mark.add(this._barMark);
      group.add(this._barMark);
    }
  }

  protected _statisticViewData(): void {
    super._statisticViewData();

    const spec = this._spec.barBackground ?? {};
    if (!spec.visible) {
      return;
    }

    const hasBandAxis = this._getRelatedComponentSpecInfo('axes').some(
      axisInfo => axisInfo.type === ComponentTypeEnum.cartesianBandAxis
    );

    let barBackgroundData: DataView;
    registerDataSetInstanceTransform(this._option.dataSet, 'addVChartProperty', addVChartProperty);

    if (hasBandAxis) {
      type DimensionItemsConfig = { scaleDepth?: number };

      /**
       * @description 准备 barBackground 数据（离散轴）
       */
      const dimensionItems = ([data]: DataView[], { scaleDepth }: DimensionItemsConfig) => {
        let dataCollect: Datum[] = [{}];
        const fields = this.getDimensionField();
        // 将维度轴的所有层级 field 的对应数据做笛卡尔积
        const depth = isNil(scaleDepth) ? fields.length : Math.min(fields.length, scaleDepth);
        for (let i = 0; i < depth; i++) {
          const field = fields[i];
          const values = data.latestData[field]?.values;
          if (!values?.length) {
            continue;
          }
          const newDataCollect: Datum[] = [];
          const dataKey = (this._spec.dataKey as string) ?? DEFAULT_DATA_KEY;
          for (let j = 0; j < values.length; j++) {
            for (let k = 0; k < dataCollect.length; k++) {
              newDataCollect.push({
                ...dataCollect[k],
                [field]: values[j],
                [dataKey]: values[j]
              });
            }
          }
          dataCollect = newDataCollect;
        }
        return dataCollect;
      };

      registerDataSetInstanceTransform(this._option.dataSet, 'dimensionItems', dimensionItems);

      barBackgroundData = new DataView(this._option.dataSet)
        .parse([this._viewDataStatistics], {
          type: 'dataview'
        })
        .transform(
          {
            type: 'dimensionItems',
            options: {
              scaleDepth: isNil(spec.fieldLevel) ? undefined : spec.fieldLevel + 1
            } as DimensionItemsConfig
          },
          false
        )
        .transform(
          {
            type: 'addVChartProperty',
            options: {
              beforeCall: initKeyMap.bind(this),
              call: addDataKey
            }
          },
          false
        );

      this._viewDataStatistics?.target.addListener('change', barBackgroundData.reRunAllTransform);
    } else {
      /**
       * @description 准备 barBackground 数据（连续轴）
       */
      const dimensionItems = ([data]: DataView[]) => {
        const dataCollect: Datum[] = [];
        const [field0, field1] = this.getDimensionContinuousField();
        const map: Record<string, Datum> = {};
        viewData.latestData.forEach((datum: Datum) => {
          const key = `${datum[field0]}-${datum[field1]}`;
          if (!map[key]) {
            map[key] = {
              [field0]: datum[field0],
              [field1]: datum[field1]
            };
            dataCollect.push(map[key]);
          }
        });
        return dataCollect;
      };

      registerDataSetInstanceTransform(this._option.dataSet, 'dimensionItems', dimensionItems);

      const viewData = this.getViewData();
      barBackgroundData = new DataView(this._option.dataSet)
        .parse([viewData], {
          type: 'dataview'
        })
        .transform(
          {
            type: 'dimensionItems'
          },
          false
        )
        .transform(
          {
            type: 'addVChartProperty',
            options: {
              beforeCall: initKeyMap.bind(this),
              call: addDataKey
            }
          },
          false
        );

      viewData?.target.addListener('change', barBackgroundData.reRunAllTransform);
    }
    this._barBackgroundViewData = new CompilableData(this._option, barBackgroundData);
  }

  init(option: IModelInitOption): void {
    super.init(option);
    this.initRectMarkStyle();
  }

  private _shouldDoPreCalculate() {
    const region = this.getRegion();
    return this.getStack() && region.getSeries().filter(s => s.type === this.type && s.getSpec().barMinHeight).length;
  }

  private _calculateStackRectPosition(isVertical: boolean) {
    const region = this.getRegion();

    // @ts-ignore
    if (region._bar_series_position_calculated) {
      return;
    }
    // @ts-ignore
    region._bar_series_position_calculated = true; // 因为是 region 内堆叠矩形的计算，所以加一个 hack 标识位用于避免重复计算
    let start: string;
    let end: string;
    let startMethod: string;
    let endMethod: string;
    let axisHelper: string;
    if (isVertical) {
      start = RECT_Y1;
      end = RECT_Y;
      startMethod = '_dataToPosY1';
      endMethod = '_dataToPosY';
      axisHelper = '_yAxisHelper';
    } else {
      start = RECT_X1;
      end = RECT_X;
      startMethod = '_dataToPosX1';
      endMethod = '_dataToPosX';
      axisHelper = '_xAxisHelper';
    }

    // only reCompute bar
    const stackValueGroup = getRegionStackGroup(region, false, s => s.type === this.type);
    // 按照堆积逻辑 重新计算一次图形的堆积位置并设置到数据上
    for (const stackValue in stackValueGroup) {
      for (const key in stackValueGroup[stackValue].nodes) {
        stackWithMinHeight(stackValueGroup[stackValue].nodes[key], region.getStackInverse(), {
          isVertical,
          start,
          end,
          startMethod,
          endMethod,
          axisHelper
        });
      }
    }
  }

  private _calculateRectPosition(datum: Datum, isVertical: boolean, useWholeRange?: boolean) {
    let startMethod: string;
    let endMethod: string;
    let axisHelper: string;
    if (isVertical) {
      startMethod = '_dataToPosY1';
      endMethod = '_dataToPosY';
      axisHelper = '_yAxisHelper';
    } else {
      startMethod = '_dataToPosX1';
      endMethod = '_dataToPosX';
      axisHelper = '_xAxisHelper';
    }

    const seriesScale = this[axisHelper].getScale?.(0);
    const inverse = this[axisHelper].isInverse();
    const barMinHeight = this._spec.barMinHeight;
    const y1 = valueInScaleRange(this[startMethod](datum), seriesScale, useWholeRange);
    const y = valueInScaleRange(this[endMethod](datum), seriesScale, useWholeRange);
    let height = Math.abs(y1 - y);
    if (height <= 0 && !isValueInScaleDomain(datum[this.getStackValueField()], seriesScale)) {
      height = 0;
    } else if (height < barMinHeight) {
      height = barMinHeight;
    }

    let flag = 1;
    if (y < y1) {
      flag = -1;
    } else if (y === y1) {
      flag = isVertical ? (inverse ? 1 : -1) : inverse ? -1 : 1;
    }
    return y1 + flag * height;
  }

  // 用于 bar-like 的位置转换，range-column 会重写这个方法
  protected _dataToPosX(datum: Datum) {
    return this.dataToPositionX(datum);
  }

  // 用于 bar-like 的位置转换，range-column 会重写这个方法
  protected _dataToPosX1(datum: Datum) {
    return this.dataToPositionX1(datum);
  }

  // 用于 bar-like 的位置转换，range-column 会重写这个方法
  protected _dataToPosY(datum: Datum) {
    return this.dataToPositionY(datum);
  }

  // 用于 bar-like 的位置转换，range-column 会重写这个方法
  protected _dataToPosY1(datum: Datum) {
    return this.dataToPositionY1(datum);
  }

  protected _getLinearBarRange = (start: number, end: number) => {
    let [x, x1] = [start, end].sort((a, b) => a - b);
    const realBarWidth = x1 - x;
    if (this._spec.barGap) {
      const halfBarGap = this._spec.barGap * 0.5;
      const tempX = x + halfBarGap;
      const tempX1 = x1 - halfBarGap;
      x = tempX;
      x1 = tempX1;
    }

    const curBarWidth = x1 - x;
    const barMinWidth = getActualNumValue(this._spec.barMinWidth || 2, realBarWidth);
    if (curBarWidth < barMinWidth) {
      const widthDiff = barMinWidth - curBarWidth;
      const halfWidthDiff = widthDiff / 2;
      x -= halfWidthDiff;
      x1 += halfWidthDiff;
    }

    return [x, x1];
  };

  protected _getBarXStart = (datum: Datum, scale: IBaseScale, useWholeRange?: boolean) => {
    if (this._shouldDoPreCalculate()) {
      this._calculateStackRectPosition(false);
      return datum[RECT_X];
    }

    if (this._spec.barMinHeight) {
      return this._calculateRectPosition(datum, false, useWholeRange);
    }

    return valueInScaleRange(this._dataToPosX(datum), scale, useWholeRange);
  };

  protected _getBarXEnd = (datum: Datum, scale: IBaseScale, useWholeRange?: boolean) => {
    if (this._shouldDoPreCalculate()) {
      this._calculateStackRectPosition(false);
      return datum[RECT_X1];
    }

    return valueInScaleRange(this._dataToPosX1(datum), scale, useWholeRange);
  };

  protected _getLinearBarXRange = (datum: Datum, scale: IBaseScale, useWholeRange?: boolean) => {
    const x = valueInScaleRange(this._dataToPosX(datum), scale, useWholeRange);
    const x1 = valueInScaleRange(this._dataToPosX1(datum), scale, useWholeRange);
    return this._getLinearBarRange(x, x1);
  };

  protected _getBarYStart = (datum: Datum, scale: IBaseScale) => {
    if (this._shouldDoPreCalculate()) {
      this._calculateStackRectPosition(true);
      return datum[RECT_Y];
    }

    if (this._spec.barMinHeight) {
      return this._calculateRectPosition(datum, true);
    }

    return valueInScaleRange(this._dataToPosY(datum), scale);
  };

  protected _getBarYEnd = (datum: Datum, scale: IBaseScale) => {
    if (this._shouldDoPreCalculate()) {
      this._calculateStackRectPosition(true);
      return datum[RECT_Y1];
    }

    return valueInScaleRange(this._dataToPosY1(datum), scale);
  };

  protected _getLinearBarYRange = (datum: Datum, scale: IBaseScale, useWholeRange?: boolean) => {
    const y = valueInScaleRange(this._dataToPosY(datum), scale, useWholeRange);
    const y1 = valueInScaleRange(this._dataToPosY1(datum), scale, useWholeRange);
    return this._getLinearBarRange(y, y1);
  };

  initBandRectMarkStyle() {
    const xScale = this._xAxisHelper?.getScale?.(0);
    const yScale = this._yAxisHelper?.getScale?.(0);

    // guess the direction which the user want
    if (this.direction === Direction.horizontal) {
      this.setMarkStyle(
        this._barMark,
        {
          x: datum => this._getBarXStart(datum, xScale),
          x1: datum => this._getBarXEnd(datum, xScale),
          y: datum => this._getPosition(this.direction, datum),
          height: () => this._getBarWidth(this._yAxisHelper),
          width: () => undefined,
          y1: () => undefined
        },
        'normal',
        AttributeLevel.Series
      );
    } else {
      this.setMarkStyle(
        this._barMark,
        {
          y: datum => this._getBarYStart(datum, yScale),
          y1: datum => this._getBarYEnd(datum, yScale),
          x: datum => this._getPosition(this.direction, datum),
          width: () => this._getBarWidth(this._xAxisHelper),
          x1: () => undefined,
          height: () => undefined
        },
        'normal',
        AttributeLevel.Series
      );
    }

    this._initStackBarMarkStyle();

    this._initBandBarBackgroundMarkStyle();
  }

  protected _initStackBarMarkStyle() {
    if (!this._spec.stackCornerRadius) {
      const markConfig = this._barMark.getMarkConfig();

      if (markConfig.clip || !isNil(markConfig.clipPath)) {
        this._barMark.setMarkConfig({
          clip: false,
          clipPath: []
        });
      }
      return;
    }

    const xScale = this._xAxisHelper?.getScale?.(0);
    const yScale = this._yAxisHelper?.getScale?.(0);
    const isVertical = this.direction === Direction.vertical;

    this._barMark.setMarkConfig({
      clip: true,
      clipPath: () => {
        const usePreCalculatedRect = !!this._shouldDoPreCalculate();
        if (usePreCalculatedRect) {
          this._calculateStackRectPosition(isVertical);
        }
        const rectPaths: any[] = [];
        this._forEachStackGroup(node => {
          let min = Infinity;
          let max = -Infinity;
          let rectMin = Infinity;
          let rectMax = -Infinity;
          let hasPercent = false;
          let minPercent = Infinity;
          let maxPercent = -Infinity;
          node.values.forEach(datum => {
            const start = datum[STACK_FIELD_START];
            const end = datum[STACK_FIELD_END];
            const startPercent = datum[STACK_FIELD_START_PERCENT];
            const endPercent = datum[STACK_FIELD_END_PERCENT];
            min = Math.min(min, start, end);
            max = Math.max(max, start, end);
            if (usePreCalculatedRect) {
              const rectStart = datum[isVertical ? RECT_Y : RECT_X];
              const rectEnd = datum[isVertical ? RECT_Y1 : RECT_X1];
              rectMin = Math.min(rectMin, rectStart, rectEnd);
              rectMax = Math.max(rectMax, rectStart, rectEnd);
            }
            if (isValid(startPercent) && isValid(endPercent)) {
              hasPercent = true;
              minPercent = Math.min(minPercent, startPercent, endPercent);
              maxPercent = Math.max(maxPercent, startPercent, endPercent);
            }
          });
          const mockDatum = {
            ...node.values[0],
            [STACK_FIELD_START]: min,
            [STACK_FIELD_END]: max,
            ...(hasPercent
              ? {
                  [STACK_FIELD_START_PERCENT]: minPercent,
                  [STACK_FIELD_END_PERCENT]: maxPercent
                }
              : undefined)
          };
          const rectAttr =
            this.direction === Direction.horizontal
              ? {
                  x: usePreCalculatedRect ? rectMin : this._getBarXStart(mockDatum, xScale),
                  x1: usePreCalculatedRect ? rectMax : this._getBarXEnd(mockDatum, xScale),
                  y: this._getPosition(this.direction, mockDatum),
                  height: this._getBarWidth(this._yAxisHelper)
                }
              : {
                  y: usePreCalculatedRect ? rectMin : this._getBarYStart(mockDatum, yScale),
                  y1: usePreCalculatedRect ? rectMax : this._getBarYEnd(mockDatum, yScale),
                  x: this._getPosition(this.direction, mockDatum),
                  width: this._getBarWidth(this._xAxisHelper)
                };
          rectPaths.push(
            createRect({
              ...rectAttr,
              cornerRadius: isFunction(this._spec.stackCornerRadius)
                ? this._spec.stackCornerRadius(rectAttr, mockDatum, this._markAttributeContext)
                : this._spec.stackCornerRadius,
              fill: true
            })
          );
        });
        return rectPaths;
      }
    });
  }

  initLinearRectMarkStyle() {
    const xScale = this._xAxisHelper?.getScale?.(0);
    const yScale = this._yAxisHelper?.getScale?.(0);

    if (this.direction === Direction.horizontal) {
      const yChannels = isValid(this._fieldY2)
        ? {
            y: (datum: Datum) => this._getLinearBarYRange(datum, yScale, true)[0],
            y1: (datum: Datum) => this._getLinearBarYRange(datum, yScale, true)[1]
          }
        : {
            y: (datum: Datum) =>
              valueInScaleRange(this._dataToPosY(datum) - this._getBarWidth(this._yAxisHelper) / 2, yScale, true),
            height: (datum: Datum) => this._getBarWidth(this._yAxisHelper)
          };

      this.setMarkStyle(
        this._barMark,
        {
          x: (datum: Datum) => this._getBarXStart(datum, xScale, true),
          x1: (datum: Datum) => this._getBarXEnd(datum, xScale, true),
          ...yChannels
        },
        'normal',
        AttributeLevel.Series
      );
      this.setMarkStyle(
        this._barBackgroundMark,
        {
          x: () => this._getBarBackgroundXStart(xScale),
          x1: () => this._getBarBackgroundXEnd(xScale),
          ...yChannels
        },
        'normal',
        AttributeLevel.Series
      );
    } else {
      const xChannels = isValid(this._fieldX2)
        ? {
            x: (datum: Datum) => this._getLinearBarXRange(datum, xScale, true)[0],
            x1: (datum: Datum) => this._getLinearBarXRange(datum, xScale, true)[1]
          }
        : {
            x: (datum: Datum) =>
              valueInScaleRange(this._dataToPosX(datum) - this._getBarWidth(this._xAxisHelper) / 2, xScale, true),
            width: (datum: Datum) => this._getBarWidth(this._xAxisHelper)
          };
      this.setMarkStyle(
        this._barMark,
        {
          ...xChannels,
          y: datum => this._getBarYStart(datum, yScale),
          y1: datum => this._getBarYEnd(datum, yScale)
        },
        'normal',
        AttributeLevel.Series
      );
      this.setMarkStyle(
        this._barBackgroundMark,
        {
          ...xChannels,
          y: () => this._getBarBackgroundYStart(yScale),
          y1: () => this._getBarBackgroundYEnd(yScale)
        },
        'normal',
        AttributeLevel.Series
      );
    }
  }

  protected _getBarBackgroundXStart = (scale: IBaseScale) => {
    const range = scale.range();
    const min = Math.min(range[0], range[range.length - 1]);
    return min;
  };

  protected _getBarBackgroundXEnd = (scale: IBaseScale) => {
    const range = scale.range();
    const max = Math.max(range[0], range[range.length - 1]);
    return max;
  };

  protected _getBarBackgroundYStart = (scale: IBaseScale) => {
    const range = scale.range();
    const min = Math.min(range[0], range[range.length - 1]);
    return min;
  };

  protected _getBarBackgroundYEnd = (scale: IBaseScale) => {
    const range = scale.range();
    const max = Math.max(range[0], range[range.length - 1]);
    return max;
  };

  protected _initBandBarBackgroundMarkStyle() {
    if (!this._barBackgroundMark) {
      return;
    }

    const xScale = this._xAxisHelper?.getScale?.(0);
    const yScale = this._yAxisHelper?.getScale?.(0);
    const spec = this._spec.barBackground ?? {};
    const scaleDepth = isNil(spec.fieldLevel) ? undefined : spec.fieldLevel + 1;

    // guess the direction which the user want
    if (this.direction === Direction.horizontal) {
      this.setMarkStyle(
        this._barBackgroundMark,
        {
          x: () => this._getBarBackgroundXStart(xScale),
          x1: () => this._getBarBackgroundXEnd(xScale),
          y: datum => this._getPosition(this.direction, datum, scaleDepth, SeriesMarkNameEnum.barBackground),
          height: () => this._getBarWidth(this._yAxisHelper, scaleDepth),
          width: () => undefined,
          y1: () => undefined
        },
        'normal',
        AttributeLevel.Series
      );
    } else {
      this.setMarkStyle(
        this._barBackgroundMark,
        {
          x: datum => this._getPosition(this.direction, datum, scaleDepth, SeriesMarkNameEnum.barBackground),
          y: () => this._getBarBackgroundYStart(yScale),
          y1: () => this._getBarBackgroundYEnd(yScale),
          width: () => this._getBarWidth(this._xAxisHelper, scaleDepth),
          x1: () => undefined,
          height: () => undefined
        },
        'normal',
        AttributeLevel.Series
      );
    }
  }

  initAnimation() {
    // 这个数据在这个时候拿不到，因为组件还没创建结束，统计和筛选也还没添加。
    // 而且这个值理论上是动态的，建议 监听 viewDataStatisticsUpdate 消息动态更新
    const barAnimationParams: IBarAnimationParams = {
      yField: this._fieldY[0],
      xField: this._fieldX[0],
      direction: this.direction,
      growFrom: () => {
        const scale = this.direction === 'horizontal' ? this._xAxisHelper?.getScale(0) : this._yAxisHelper.getScale(0);
        if (scale) {
          const domain = scale.domain();
          const domainMin = minInArr<number>(domain);
          const domainMax = maxInArr<number>(domain);
          if (domainMax < 0) {
            return scale.scale(domainMax);
          } else if (domainMin > 0) {
            return scale.scale(domainMin);
          }
          return scale.scale(0);
        }
      }
    };
    const appearPreset = (this._spec.animationAppear as IStateAnimateSpec<BarAppearPreset>)?.preset;
    const animationParams = getGroupAnimationParams(this);

    this._barMark.setAnimationConfig(
      animationConfig(
        Factory.getAnimationInKey('bar')?.(barAnimationParams, appearPreset),
        userAnimationConfig(this._barMarkName, this._spec, this._markAttributeContext),
        animationParams
      )
    );
  }

  protected _getBarWidth(axisHelper: IAxisHelper, scaleDepth?: number) {
    const depthFromSpec = this._groups ? this._groups.fields.length : 1;
    const depth = isNil(scaleDepth) ? depthFromSpec : Math.min(depthFromSpec, scaleDepth);

    const bandWidth = axisHelper.getBandwidth?.(depth - 1) ?? DefaultBandWidth;
    const hasBarWidth = isValid(this._spec.barWidth) && depth === depthFromSpec;

    const hasBarMinWidth = isValid(this._spec.barMinWidth);
    const hasBarMaxWidth = isValid(this._spec.barMaxWidth);
    let width = bandWidth;
    if (hasBarWidth) {
      width = getActualNumValue(this._spec.barWidth, bandWidth);
    }
    if (hasBarMinWidth) {
      width = Math.max(width, getActualNumValue(this._spec.barMinWidth, bandWidth));
    }
    if (hasBarMaxWidth) {
      width = Math.min(width, getActualNumValue(this._spec.barMaxWidth, bandWidth));
    }
    return width;
  }

  protected _getPosition(direction: DirectionType, datum: Datum, scaleDepth?: number, mark?: SeriesMarkNameEnum) {
    let axisHelper;
    let sizeAttribute;
    let dataToPosition;
    if (direction === Direction.horizontal) {
      axisHelper = this.getYAxisHelper();
      sizeAttribute = 'height';
      dataToPosition =
        mark === SeriesMarkNameEnum.barBackground
          ? this.dataToBarBackgroundPositionY.bind(this)
          : this.dataToPositionY.bind(this);
    } else {
      axisHelper = this.getXAxisHelper();
      sizeAttribute = 'width';
      dataToPosition =
        mark === SeriesMarkNameEnum.barBackground
          ? this.dataToBarBackgroundPositionX.bind(this)
          : this.dataToPositionX.bind(this);
    }
    const scale = axisHelper.getScale(0);

    const depthFromSpec = this._groups ? this._groups.fields.length : 1;
    const depth = isNil(scaleDepth) ? depthFromSpec : Math.min(depthFromSpec, scaleDepth);

    const bandWidth = axisHelper.getBandwidth?.(depth - 1) ?? DefaultBandWidth;
    const size = depth === depthFromSpec ? (this._barMark.getAttribute(sizeAttribute, datum) as number) : bandWidth;

    if (depth > 1 && isValid(this._spec.barGapInGroup)) {
      // 自里向外计算，沿着第一层分组的中心点进行位置调整
      const groupFields = this._groups.fields;
      const barInGroup = array(this._spec.barGapInGroup);
      let totalWidth: number = 0;
      let offSet: number = 0;

      for (let index = groupFields.length - 1; index >= 1; index--) {
        const groupField = groupFields[index];
        // const groupValues = this.getViewDataStatistics()?.latestData?.[groupField]?.values ?? [];
        const groupValues = axisHelper.getScale(index)?.domain() ?? [];
        const groupCount = groupValues.length;
        const gap = getActualNumValue(barInGroup[index - 1] ?? last(barInGroup), bandWidth);
        const i = groupValues.indexOf(datum[groupField]);
        if (index === groupFields.length - 1) {
          totalWidth += groupCount * size + (groupCount - 1) * gap;
          offSet += i * (size + gap);
        } else {
          offSet += i * (totalWidth + gap);
          totalWidth += totalWidth + (groupCount - 1) * gap;
        }
      }

      const center = scale.scale(datum[groupFields[0]]) + axisHelper.getBandwidth(0) / 2;
      return center - totalWidth / 2 + offSet;
    }

    const continuous = isContinuous(scale.type || 'band');
    const pos = dataToPosition(datum, depth);

    return pos + (bandWidth - size) * 0.5 + (continuous ? -bandWidth / 2 : 0);
  }

  protected _barBackgroundPositionXEncoder?: (datum: Datum) => number;
  protected _getBarBackgroundPositionXEncoder = () => this._barBackgroundPositionXEncoder?.bind(this);
  protected _setBarBackgroundPositionXEncoder = (encoder: (datum: Datum) => number) => {
    this._barBackgroundPositionXEncoder = encoder.bind(this);
  };

  dataToBarBackgroundPositionX(datum: Datum, scaleDepth?: number): number {
    return this._dataToPosition(
      datum,
      this._xAxisHelper,
      this.fieldX,
      scaleDepth,
      this._getBarBackgroundPositionXEncoder,
      this._setBarBackgroundPositionXEncoder
    );
  }

  protected _barBackgroundPositionYEncoder?: (datum: Datum) => number;
  protected _getBarBackgroundPositionYEncoder = () => this._barBackgroundPositionYEncoder?.bind(this);
  protected _setBarBackgroundPositionYEncoder = (encoder: (datum: Datum) => number) => {
    this._barBackgroundPositionYEncoder = encoder.bind(this);
  };

  dataToBarBackgroundPositionY(datum: Datum, scaleDepth?: number): number {
    return this._dataToPosition(
      datum,
      this._yAxisHelper,
      this.fieldY,
      scaleDepth,
      this._getBarBackgroundPositionYEncoder,
      this._setBarBackgroundPositionYEncoder
    );
  }

  onLayoutEnd(): void {
    super.onLayoutEnd();
    const region = this.getRegion();
    // @ts-ignore
    region._bar_series_position_calculated = false;
    if (this._spec.sampling) {
      this.compile();
    }
  }

  onDataUpdate(): void {
    super.onDataUpdate();

    const region = this.getRegion();
    // @ts-ignore
    region._bar_series_position_calculated = false;
  }

  compile(): void {
    super.compile();

    if (this._spec.sampling) {
      const { width, height } = this._region.getLayoutRect();
      const fieldsY = this._fieldY;
      const fieldsX = this._fieldX;

      this._data.setTransform([
        {
          type: 'sampling',
          size: this._direction === Direction.horizontal ? height : width,
          factor: this._spec.samplingFactor,
          yfield: this._direction === Direction.horizontal ? fieldsX[0] : fieldsY[0],
          groupBy: this._seriesField,
          mode: this._spec.sampling
        }
      ]);
    }
  }

  getDefaultShapeType(): string {
    return 'square';
  }

  getActiveMarks(): IMark[] {
    return [this._barMark];
  }

  compileData() {
    super.compileData();
    this._barBackgroundViewData?.compile();
  }

  fillData() {
    super.fillData();
    this._barBackgroundViewData?.getDataView()?.reRunAllTransform();
  }

  viewDataUpdate(d: DataView): void {
    super.viewDataUpdate(d);
    this._barBackgroundViewData?.getDataView()?.reRunAllTransform();
    this._barBackgroundViewData?.updateData();
  }

  release() {
    super.release();
    this._barBackgroundViewData?.release();
    this._barBackgroundViewData = null;
  }
}

export const registerBarSeries = () => {
  registerDataSamplingTransform();
  registerRectMark();
  registerBarAnimation();
  registerCartesianBandAxis();
  registerCartesianLinearAxis();
  Factory.registerSeries(BarSeries.type, BarSeries);
};
