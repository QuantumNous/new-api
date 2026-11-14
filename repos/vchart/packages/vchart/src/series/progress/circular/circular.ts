/* eslint-disable no-duplicate-imports */
import type { BandScale } from '@visactor/vscale';
import type { Datum } from '../../../typings';
import { isValidNumber } from '@visactor/vutils';
import type { SeriesMarkMap } from '../../interface';
import { SeriesMarkNameEnum, SeriesTypeEnum } from '../../interface/type';
import type { ISeriesSpecUpdatePolicy } from '../../base/base-series';
import { animationConfig, shouldMarkDoMorph, userAnimationConfig } from '../../../animation/utils';
import type { ICircularProgressSeriesSpec } from './interface';
import { ProgressLikeSeries } from '../../polar/progress-like/progress-like';
import type { IStateAnimateSpec } from '../../../animation/spec';
import { registerArcMark } from '../../../mark/arc';
import { circularProgressSeriesMark } from './constant';
import { STACK_FIELD_END, STACK_FIELD_START } from '../../../constant/data';
import { AttributeLevel } from '../../../constant/attribute';
import { Factory } from '../../../core/factory';
import { registerProgressLikeAnimation } from '../../polar/progress-like';
import { registerFadeInOutAnimation } from '../../../animation/config';
import type { IArcMark, IMark } from '../../../mark/interface';
import { CircularProgressSeriesSpecTransformer } from './circular-transformer';
import { registerPolarLinearAxis, registerPolarBandAxis } from '../../../component/axis/polar';
import { circularProgress } from '../../../theme/builtin/common/series/circular-progress';

const CIRCULAR_PROGRESS_SERIES_COMPILE_ONLY_KEYS: Record<'cornerRadius' | 'roundCap', true> = {
  cornerRadius: true,
  roundCap: true
};

export class CircularProgressSeries<
  T extends ICircularProgressSeriesSpec = ICircularProgressSeriesSpec
> extends ProgressLikeSeries<T> {
  static readonly type: string = SeriesTypeEnum.circularProgress;
  type = SeriesTypeEnum.circularProgress;

  static readonly mark: SeriesMarkMap = circularProgressSeriesMark;
  static readonly builtInTheme = { circularProgress };
  static readonly transformerConstructor = CircularProgressSeriesSpecTransformer as any;
  readonly transformerConstructor = CircularProgressSeriesSpecTransformer;

  private _progressMark: IArcMark | null = null;
  private _trackMark: IArcMark | null = null;

  protected _getSpecUpdatePolicy(): ISeriesSpecUpdatePolicy {
    const policy = super._getSpecUpdatePolicy();
    return {
      ...policy,
      compileOnlyKeys: {
        ...policy.compileOnlyKeys,
        ...CIRCULAR_PROGRESS_SERIES_COMPILE_ONLY_KEYS
      }
    };
  }

  getStackGroupFields(): string[] {
    return this.getGroupFields();
  }

  getGroupFields() {
    return this._radiusField;
  }

  initMark(): void {
    super.initMark();
    this._initTrackMark();
    this._initProgressMark();
  }

  initMarkStyle(): void {
    super.initMarkStyle();
    this._initTrackMarkStyle();
    this._initProgressMarkStyle();
  }

  private _initProgressMark() {
    this._progressMark = this._createMark(
      CircularProgressSeries.mark.progress,
      {
        parent: this._arcGroupMark,
        isSeriesMark: true
      },
      {
        morph: shouldMarkDoMorph(this._spec, SeriesMarkNameEnum.progress)
      }
    ) as IArcMark;
    return this._progressMark;
  }

  private _initProgressMarkStyle() {
    const progressMark = this._progressMark;
    if (progressMark) {
      this.setMarkStyle(
        progressMark,
        {
          x: () => this.angleAxisHelper.center().x,
          y: () => this.angleAxisHelper.center().y,
          startAngle: this._getAngleValueStart,
          endAngle: this._getAngleValueEnd,
          innerRadius: this._getRadiusValueStart,
          outerRadius: this._getRadiusValueEnd,
          cap: this._spec.roundCap ?? false,
          boundsMode: 'imprecise',
          cornerRadius: this._spec.cornerRadius,
          fill: this.getColorAttribute(),
          zIndex: 200,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          // forceShowCap 是内部属性，不在接口中暴露
          forceShowCap: true
        },
        'normal',
        AttributeLevel.Series
      );
    }
  }

  getInteractionTriggers() {
    const marks: IMark[] = [];

    if (this._trackMark) {
      marks.push(this._trackMark);
    }

    if (this._progressMark) {
      marks.push(this._progressMark);
    }
    return this._parseInteractionConfig(marks);
  }

  protected initTooltip() {
    super.initTooltip();

    this._progressMark && this._tooltipHelper.activeTriggerSet.mark.add(this._progressMark);
  }

  private _initTrackMark() {
    this._trackMark = this._createMark(CircularProgressSeries.mark.track, {
      parent: this._arcGroupMark
    }) as IArcMark;

    // 背景条不参与morphing 动画
    this._trackMark.setMarkConfig({
      morph: false,
      morphKey: null,
      morphElementKey: null
    });
    return this._trackMark;
  }

  private _initTrackMarkStyle() {
    const trackMark = this._trackMark;
    if (trackMark) {
      this.setMarkStyle(
        trackMark,
        {
          visible: (datum: Datum) => {
            const scale = this.angleAxisHelper.getScale(0);
            const range = scale.range();
            const min = Math.min(range[0], range[range.length - 1]);
            const startValue = this._getAngleValueStartWithoutMask(datum);
            // 堆叠情况只显示第一组的背景
            return Math.abs(startValue - min) <= 1e-14;
          },
          x: () => this.angleAxisHelper.center().x,
          y: () => this.angleAxisHelper.center().y,
          startAngle: () => {
            const fieldName = this.getStack() ? STACK_FIELD_START : this._angleField[0];
            const scale = this.angleAxisHelper.getScale(0);
            const domain = scale.domain();
            return this._getAngleValueStart({ [fieldName]: domain[0] });
          },
          endAngle: () => {
            const fieldName = this.getStack() ? STACK_FIELD_END : this._angleField[0];
            const scale = this.angleAxisHelper.getScale(0);
            const domain = scale.domain();
            return this._getAngleValueEnd({ [fieldName]: domain[domain.length - 1] });
          },
          innerRadius: this._getRadiusValueStart,
          outerRadius: this._getRadiusValueEnd,
          cornerRadius: this._spec.cornerRadius,
          fill: this.getColorAttribute(),
          zIndex: 100
        },
        'normal',
        AttributeLevel.Series
      );
    }
  }

  protected _getRadiusValueStart = (datum: Datum) => {
    if (this.getGroupFields().length > 1) {
      const value = this.radiusAxisHelper.dataToPosition(this.getDatumPositionValues(datum, this.getGroupFields()));
      if (isValidNumber(value)) {
        return value;
      }
    }
    return this.radiusAxisHelper.dataToPosition([datum[this._radiusField[0]]]);
  };

  protected _getRadiusValueEnd = (datum: Datum) => {
    if (this.getGroupFields().length > 1) {
      const value =
        this.radiusAxisHelper.dataToPosition(this.getDatumPositionValues(datum, this.getGroupFields())) +
        this.radiusAxisHelper.getBandwidth?.(this._groups ? this._groups.fields.length - 1 : 0);
      if (isValidNumber(value)) {
        return value;
      }
    }
    return (
      this.radiusAxisHelper.dataToPosition([datum[this._radiusField[0]]]) +
      (this.radiusAxisHelper.getScale(0) as BandScale).step()
    );
  };

  initAnimation() {
    const appearPreset = (this._spec?.animationAppear as IStateAnimateSpec<any>)?.preset;

    this._progressMark.setAnimationConfig(
      animationConfig(
        Factory.getAnimationInKey('circularProgress')?.({ startAngle: this._startAngle }, appearPreset),
        userAnimationConfig(SeriesMarkNameEnum.progress, this._spec, this._markAttributeContext)
      )
    );

    this._trackMark.setAnimationConfig(
      animationConfig(
        Factory.getAnimationInKey('fadeInOut')?.(),
        userAnimationConfig(SeriesMarkNameEnum.track, this._spec, this._markAttributeContext)
      )
    );
  }

  getActiveMarks(): IMark[] {
    return [this._progressMark];
  }
}

export const registerCircularProgressSeries = () => {
  Factory.registerSeries(CircularProgressSeries.type, CircularProgressSeries);
  registerArcMark();
  registerProgressLikeAnimation();
  registerFadeInOutAnimation();
  registerPolarBandAxis();
  registerPolarLinearAxis();
};
