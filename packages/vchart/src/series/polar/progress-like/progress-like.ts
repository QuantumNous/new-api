import { degreeToRadian, isNil, isValid, isValidNumber, binaryFuzzySearch } from '@visactor/vutils';
import { SEGMENT_FIELD_START, STACK_FIELD_END, STACK_FIELD_START } from '../../../constant/data';
import { POLAR_END_RADIAN, POLAR_START_RADIAN } from '../../../constant/polar';
import { AttributeLevel } from '../../../constant/attribute';
import type { IGroupMark, IMarkStyle } from '../../../mark/interface';
import type { ConvertToMarkStyleSpec, Datum, ICommonSpec } from '../../../typings';
import { valueInScaleRange } from '../../../util/scale';
import { PolarSeries } from '../polar';
import type { IContinuousTickData, IProgressLikeSeriesSpec } from './interface';
import type { IPolarAxis, IPolarAxisSpec } from '../../../component/axis';
import { createArc, createRect } from '@visactor/vrender-core';
import type { SeriesMarkMap } from '../../interface';
import { progressLikeSeriesMark } from './constant';
import type { ISeriesSpecUpdatePolicy } from '../../base/base-series';

const PROGRESS_LIKE_SERIES_COMPILE_ONLY_KEYS: Record<
  'radius' | 'outerRadius' | 'innerRadius' | 'startAngle' | 'endAngle' | 'centerX' | 'centerY' | 'clamp',
  true
> = {
  radius: true,
  outerRadius: true,
  innerRadius: true,
  startAngle: true,
  endAngle: true,
  centerX: true,
  centerY: true,
  clamp: true
};

export abstract class ProgressLikeSeries<T extends IProgressLikeSeriesSpec> extends PolarSeries<T> {
  static readonly mark: SeriesMarkMap = progressLikeSeriesMark;

  protected _startAngle: number;
  protected _endAngle: number;

  protected _arcGroupMark: IGroupMark | null = null;

  protected _getSpecUpdatePolicy(): ISeriesSpecUpdatePolicy {
    const policy = super._getSpecUpdatePolicy();
    return {
      ...policy,
      compileOnlyKeys: {
        ...policy.compileOnlyKeys,
        ...PROGRESS_LIKE_SERIES_COMPILE_ONLY_KEYS
      }
    };
  }

  setAttrFromSpec(): void {
    super.setAttrFromSpec();
    const chartSpec = this._option.globalInstance.getChart()?.getSpec() as any;
    const startAngle = this._spec.startAngle ?? chartSpec?.startAngle;
    this._startAngle = isValid(startAngle) ? degreeToRadian(startAngle) : POLAR_START_RADIAN;
    const endAngle = this._spec.endAngle ?? chartSpec?.endAngle;
    this._endAngle = isValid(endAngle) ? degreeToRadian(endAngle) : POLAR_END_RADIAN;

    // 值信息给角度
    this.setAngleField(this._spec.valueField || this._spec.angleField);
    // 分类信息给半径
    this.setRadiusField(this._spec.categoryField || this._spec.radiusField);

    this._specAngleField = this._angleField.slice();
    this._specRadiusField = this._radiusField.slice();
  }

  getStackGroupFields(): string[] {
    return this._radiusField;
  }

  getStackValueField() {
    return this._angleField?.[0];
  }

  getGroupFields() {
    return this._angleField;
  }

  /** 重载 mark style 赋值前转换逻辑 */
  protected _convertMarkStyle<T extends ICommonSpec = ICommonSpec>(
    style: Partial<IMarkStyle<T> | ConvertToMarkStyleSpec<T>>
  ): Partial<IMarkStyle<T> | ConvertToMarkStyleSpec<T>> {
    const newStyle = super._convertMarkStyle(style) as unknown as any;

    const fillKey = 'fill';
    if (newStyle[fillKey]) {
      const value = style[fillKey] as unknown as any;
      // 为环形渐变色自动加 startAngle 和 endAngle
      if (value?.gradient === 'conical' && !isValid(value?.startAngle) && !isValid(value?.endAngle)) {
        newStyle[fillKey] = {
          ...value,
          startAngle: this._startAngle,
          endAngle: this._endAngle
        };
      }
    }

    return newStyle;
  }

  protected _getAngleValueStart = (datum: Datum) => {
    const axis = this._getAngleAxis();
    const { tickMask } = this._spec;

    if (tickMask?.forceAlign && this._isTickMaskVisible(axis)) {
      const field = this.getStack() ? STACK_FIELD_START : SEGMENT_FIELD_START;
      const originValue = datum[field];
      const subTickData = this._getAngleAxisSubTickData(axis);
      const step = subTickData[1].value - subTickData[0].value;
      const offsetAngle = degreeToRadian(tickMask.offsetAngle);

      let pos: number | undefined;
      if (isValid(originValue)) {
        // 找到第一个大于等于数据值的 tick
        const index = binaryFuzzySearch(subTickData, tick => tick.value - originValue);
        // 对齐
        const targetIndex =
          index >= subTickData.length || originValue > subTickData[index].value - step / 2
            ? Math.min(index, subTickData.length - 1)
            : index > 0
            ? index - 1
            : undefined;
        if (targetIndex !== undefined) {
          pos = this.angleAxisHelper.dataToPosition([
            subTickData[targetIndex].value - step / 2 // 确保占满整个 tick mask
          ]);
        }
      }
      if (isNil(pos)) {
        pos = this.angleAxisHelper.dataToPosition(
          [subTickData[0].value - step / 2] // 确保空出整个 tick mask
        );
      }
      return pos + offsetAngle;
    }
    return this._getAngleValueStartWithoutMask(datum);
  };

  protected _getAngleValueEnd = (datum: Datum) => {
    const axis = this._getAngleAxis();
    const { tickMask } = this._spec;

    if (tickMask?.forceAlign && this._isTickMaskVisible(axis)) {
      const field = this.getStack() ? STACK_FIELD_END : this._angleField[0];
      const originValue = datum[field];
      const subTickData = this._getAngleAxisSubTickData(axis);
      const step = subTickData[1].value - subTickData[0].value;
      const offsetAngle = degreeToRadian(tickMask.offsetAngle);

      // 找到第一个大于等于数据值的 tick
      const index = binaryFuzzySearch(subTickData, tick => tick.value - originValue);
      // 对齐
      const targetIndex =
        index >= subTickData.length || originValue > subTickData[index].value - step / 2
          ? Math.min(index, subTickData.length - 1)
          : index > 0
          ? index - 1
          : undefined;
      let pos: number;
      if (targetIndex !== undefined) {
        pos = this.angleAxisHelper.dataToPosition([
          subTickData[targetIndex].value + step / 2 // 确保占满整个 tick mask
        ]);
      } else {
        pos = this.angleAxisHelper.dataToPosition([
          subTickData[0].value - step / 2 // 确保空出整个 tick mask
        ]);
      }
      return pos + offsetAngle;
    }
    return this._getAngleValueEndWithoutMask(datum);
  };

  protected _getAngleValueStartWithoutMask(datum: Datum) {
    if (this.getStack()) {
      const value = valueInScaleRange(
        this.angleAxisHelper.dataToPosition([datum[STACK_FIELD_START]]),
        this.angleAxisHelper.getScale(0)
      );
      if (isValidNumber(value)) {
        return value;
      }
    }
    return this._startAngle;
  }

  protected _getAngleValueEndWithoutMask(datum: Datum) {
    if (this.getStack()) {
      const value = valueInScaleRange(
        this.angleAxisHelper.dataToPosition([datum[STACK_FIELD_END]]),
        this.angleAxisHelper.getScale(0)
      );
      if (isValidNumber(value)) {
        return value;
      }
    }
    const angle = this.angleAxisHelper.dataToPosition([datum[this._angleField[0]]]);
    return this._spec.clamp ? valueInScaleRange(angle, this.angleAxisHelper.getScale(0)) : angle;
  }

  getDimensionField(): string[] {
    return this._specRadiusField;
  }

  getMeasureField(): string[] {
    return this._specAngleField;
  }

  initMark(): void {
    this._initArcGroupMark();
  }

  initMarkStyle(): void {
    this._initArcGroupMarkStyle();
  }

  protected _initArcGroupMark() {
    // FIXME: disable group mark layout to prevent reevaluate after layout end
    this._arcGroupMark = this._createMark(ProgressLikeSeries.mark.group, {
      skipBeforeLayouted: false
    }) as IGroupMark;
    return this._arcGroupMark;
  }

  protected _initArcGroupMarkStyle() {
    const groupMark = this._arcGroupMark;
    groupMark.created();
    this.setMarkStyle(
      groupMark,
      {
        x: 0,
        y: 0
      },
      'normal',
      AttributeLevel.Series
    );
    this._arcGroupMark.setMarkConfig({
      interactive: false,
      zIndex: this.layoutZIndex,
      clip: true,
      clipPath: () => {
        const axis = this._getAngleAxis();
        const { x, y } = this.angleAxisHelper.center();
        const radius = this._computeLayoutRadius();
        if (this._isTickMaskVisible(axis)) {
          const { tickMask } = this._spec;
          const { angle, offsetAngle, style = {} } = tickMask;
          const subTickData = this._getAngleAxisSubTickData(axis);
          const markStyle = style as any;
          return subTickData.map(({ value }) => {
            const pos = this.angleAxisHelper.dataToPosition([value]) + degreeToRadian(offsetAngle);
            const angleUnit = degreeToRadian(angle) / 2;
            return createArc({
              ...markStyle,
              x,
              y,
              startAngle: pos - angleUnit,
              endAngle: pos + angleUnit,
              innerRadius: radius * this._innerRadius,
              outerRadius: radius * this._outerRadius,
              fill: true
            });
          });
        }
        const { width, height } = this.getLayoutRect();
        return [
          createRect({
            width,
            height,
            fill: true
          })
        ];
      }
    });
  }

  protected _getAngleAxis() {
    if (!this.angleAxisHelper) {
      return undefined;
    }
    const angleAxisId = this.angleAxisHelper.getAxisId();
    const angleAxis = this._option
      .getChart()
      .getAllComponents()
      .find(component => component.id === angleAxisId) as IPolarAxis;
    return angleAxis;
  }

  protected _getAngleAxisTickData(angleAxis?: IPolarAxis): IContinuousTickData[] {
    const tickData = angleAxis?.getTickData()?.getLatestData();
    return tickData;
  }

  protected _isTickMaskVisible(angleAxis?: IPolarAxis) {
    const tickData = this._getAngleAxisTickData(angleAxis);
    const { tickMask } = this._spec;
    return tickMask && tickMask.visible !== false && tickData?.length > 1;
  }

  protected _getAngleAxisSubTickData(angleAxis: IPolarAxis) {
    const tickData = this._getAngleAxisTickData(angleAxis);
    // TODO: 这块照搬了 vrender-components 的计算方法，需要抽出这块的公用逻辑
    const subTickData: IContinuousTickData[] = [];
    const { subTick = {}, tick = {} } = (angleAxis?.getSpec() ?? {}) as IPolarAxisSpec;
    const { tickCount: subTickCount = 4 } = subTick;
    const { alignWithLabel } = tick;
    // 刻度线的数量大于 2 时，才绘制子刻度
    if (tickData?.length >= 2) {
      const tickSegment = tickData[1].value - tickData[0].value;
      for (let i = 0; i < tickData.length - 1; i++) {
        const pre = tickData[i];
        const next = tickData[i + 1];
        subTickData.push(pre);
        for (let j = 0; j < subTickCount; j++) {
          const percent = (j + 1) / (subTickCount + 1);
          const value =
            (1 - percent) * pre.value + percent * (next ? next.value : alignWithLabel ? 1 : pre.value + tickSegment);
          subTickData.push({
            value
          });
        }
      }
      subTickData.push(tickData[tickData.length - 1]);
      return subTickData;
    }
    return tickData;
  }
}
