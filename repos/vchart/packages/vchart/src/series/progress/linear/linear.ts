/* eslint-disable no-duplicate-imports */
import { CartesianSeries } from '../../cartesian/cartesian';
import type { SeriesMarkMap } from '../../interface';
import { SeriesMarkNameEnum, SeriesTypeEnum } from '../../interface/type';
import { valueInScaleRange } from '../../../util/scale';
import { AttributeLevel } from '../../../constant/attribute';
import type { Datum } from '../../../typings';
import { animationConfig, userAnimationConfig } from '../../../animation/utils';
import { registerLinearProgressAnimation } from './animation';
import type {
  ILinearProgressAnimationParams,
  ILinearProgressSeriesSpec,
  LinearProgressAppearPreset
} from './interface';
import { LinearProgressSeriesTooltipHelper } from './tooltip-helper';
import type { IStateAnimateSpec } from '../../../animation/spec';
import { registerRectMark } from '../../../mark/rect';
import type { ICustomPath2D } from '@visactor/vrender-core';
import { linearProgressSeriesMark } from './constant';
import { Factory } from '../../../core/factory';
import { registerFadeInOutAnimation } from '../../../animation/config';
import type { IMark, IRectMark } from '../../../mark/interface';
import { isNil, isValid } from '@visactor/vutils';
import { linearProgress } from '../../../theme/builtin/common/series/linear-progress';
import type { ISeriesSpecUpdatePolicy } from '../../base/base-series';

const LINEAR_PROGRESS_SERIES_COMPILE_ONLY_KEYS: Record<'bandWidth' | 'cornerRadius' | 'clamp', true> = {
  bandWidth: true,
  cornerRadius: true,
  clamp: true
};

const LINEAR_PROGRESS_SERIES_COMPILE_ONLY_SUB_KEYS: Record<
  'progress',
  Record<'topPadding' | 'bottomPadding' | 'leftPadding' | 'rightPadding', true>
> = {
  progress: {
    topPadding: true,
    bottomPadding: true,
    leftPadding: true,
    rightPadding: true
  }
};

export class LinearProgressSeries<
  T extends ILinearProgressSeriesSpec = ILinearProgressSeriesSpec
> extends CartesianSeries<T> {
  static readonly type: string = SeriesTypeEnum.linearProgress;
  type = SeriesTypeEnum.linearProgress;

  static readonly mark: SeriesMarkMap = linearProgressSeriesMark;
  static readonly builtInTheme = { linearProgress };

  private _progressMark: IRectMark | null = null;
  private _trackMark: IRectMark | null = null;

  protected _getSpecUpdatePolicy(): ISeriesSpecUpdatePolicy {
    const policy = super._getSpecUpdatePolicy();
    return {
      ...policy,
      compileOnlyKeys: {
        ...policy.compileOnlyKeys,
        ...LINEAR_PROGRESS_SERIES_COMPILE_ONLY_KEYS
      },
      compileOnlySubKeys: {
        ...policy.compileOnlySubKeys,
        ...LINEAR_PROGRESS_SERIES_COMPILE_ONLY_SUB_KEYS
      }
    };
  }

  initMark(): void {
    this._initTrackMark();
    this._initProgressMark();
  }

  initMarkStyle(): void {
    this._initTrackMarkStyle();
    this._initProgressMarkStyle();
  }

  private _initProgressMark() {
    this._progressMark = this._createMark(LinearProgressSeries.mark.progress, {
      isSeriesMark: true
    }) as IRectMark;

    if (isNil(this._spec.progress?.customShape)) {
      this._progressMark.setMarkConfig({
        setCustomizedShape: this._defaultProgressCustomShape
      });
    }
    return this._progressMark;
  }

  private _initProgressMarkStyle() {
    const progressMark = this._progressMark;
    if (progressMark) {
      if (this._spec.direction === 'vertical') {
        const progress = this._spec.progress || {};
        const leftPadding = progress.leftPadding ?? 0;
        const rightPadding = progress.rightPadding ?? 0;

        this.setMarkStyle(
          progressMark,
          {
            x: (datum: Datum) => {
              return (
                valueInScaleRange(this.dataToPositionX(datum), this._xAxisHelper?.getScale?.(0), true) -
                this._spec.bandWidth / 2 +
                leftPadding
              );
            },
            y1: (datum: Datum) => valueInScaleRange(this.dataToPositionY(datum), this._yAxisHelper?.getScale?.(0)),
            y: () => {
              const value = this._yAxisHelper?.dataToPosition([0], { bandPosition: this._bandPosition });
              return this._spec.clamp ? valueInScaleRange(value, this._yAxisHelper?.getScale?.(0)) : value;
            },
            width: this._spec.bandWidth - leftPadding - rightPadding,
            cornerRadius: this._spec.cornerRadius,
            fill: this.getColorAttribute()
          },
          'normal',
          AttributeLevel.Series
        );
      } else {
        const progress = this._spec.progress || {};
        const topPadding = progress.topPadding ?? 0;
        const bottomPadding = progress.bottomPadding ?? 0;

        this.setMarkStyle(
          progressMark,
          {
            x1: (datum: Datum) => valueInScaleRange(this.dataToPositionX(datum), this._xAxisHelper?.getScale?.(0)),
            y: (datum: Datum) => {
              return (
                valueInScaleRange(this.dataToPositionY(datum), this._yAxisHelper?.getScale?.(0), true) -
                this._spec.bandWidth / 2 +
                topPadding
              );
            },
            height: this._spec.bandWidth - topPadding - bottomPadding,
            x: () => {
              const value = this._xAxisHelper?.dataToPosition([0], { bandPosition: this._bandPosition });
              return this._spec.clamp ? valueInScaleRange(value, this._xAxisHelper?.getScale?.(0)) : value;
            },
            cornerRadius: this._spec.cornerRadius,
            fill: this.getColorAttribute()
          },
          'normal',
          AttributeLevel.Series
        );
      }
    }
  }

  private _defaultProgressCustomShape = (datum: any[], attrs: any, path: ICustomPath2D) => {
    const cornerRadius = this._spec?.cornerRadius;
    const width = isValid(attrs.width) ? attrs.width : attrs.x1 - attrs.x;
    const height = isValid(attrs.height) ? attrs.height : attrs.y1 - attrs.y;
    const x0 = Math.min(0, width);
    const x1 = Math.max(0, width);
    const y0 = Math.min(0, height);
    const y1 = Math.max(0, height);

    if (cornerRadius > 0) {
      let realCornerRadius = cornerRadius;

      if (this._spec?.direction === 'vertical') {
        realCornerRadius = Math.min(Math.abs(width / 2), cornerRadius);

        if (2 * realCornerRadius > Math.abs(height)) {
          const angle = Math.acos((realCornerRadius - Math.abs(height) / 2) / realCornerRadius);

          path.moveTo(x0 + realCornerRadius, y0);
          path.arc(
            x0 + realCornerRadius,
            y0 + realCornerRadius,
            realCornerRadius,
            1.5 * Math.PI,
            1.5 * Math.PI - angle,
            true
          );
          path.arc(
            x0 + realCornerRadius,
            y1 - realCornerRadius,
            realCornerRadius,
            angle + Math.PI / 2,
            Math.PI / 2,
            true
          );

          path.lineTo(x1 - cornerRadius, y1);
          path.arc(
            x1 - realCornerRadius,
            y1 - realCornerRadius,
            realCornerRadius,
            Math.PI / 2,
            Math.PI / 2 - angle,
            true
          );
          path.arc(
            x1 - realCornerRadius,
            y0 + realCornerRadius,
            realCornerRadius,
            -Math.PI / 2 + angle,
            -Math.PI / 2,
            true
          );
          path.lineTo(x0 + realCornerRadius, y0);

          path.closePath();

          return path;
        }
      } else {
        realCornerRadius = Math.min(Math.abs(height / 2), cornerRadius);

        if (2 * realCornerRadius > Math.abs(width)) {
          const angle = Math.acos((realCornerRadius - Math.abs(width) / 2) / realCornerRadius);
          path.moveTo(x0, y0 + realCornerRadius);
          path.arc(x0 + realCornerRadius, y0 + realCornerRadius, realCornerRadius, Math.PI, Math.PI + angle);
          path.arc(x1 - realCornerRadius, y0 + realCornerRadius, realCornerRadius, -angle, 0);
          path.lineTo(x1, y1 - realCornerRadius);
          path.arc(x1 - realCornerRadius, y1 - realCornerRadius, realCornerRadius, 0, angle);
          path.arc(x0 + realCornerRadius, y1 - realCornerRadius, realCornerRadius, Math.PI - angle, Math.PI);
          path.closePath();

          return path;
        }
      }

      path.moveTo(x0, y0 + realCornerRadius);
      path.arc(x0 + realCornerRadius, y0 + realCornerRadius, realCornerRadius, Math.PI, 1.5 * Math.PI);
      path.lineTo(x1 - realCornerRadius, y0);
      path.arc(x1 - realCornerRadius, y0 + realCornerRadius, realCornerRadius, -Math.PI / 2, 0);
      path.lineTo(x1, y1 - realCornerRadius);
      path.arc(x1 - realCornerRadius, y1 - realCornerRadius, realCornerRadius, 0, Math.PI / 2);
      path.lineTo(x0 + realCornerRadius, y1);
      path.arc(x0 + realCornerRadius, y1 - realCornerRadius, realCornerRadius, Math.PI / 2, Math.PI);
      path.closePath();
    } else {
      path.moveTo(x0, y0);
      path.lineTo(x1, y0);
      path.lineTo(x1, y1);
      path.lineTo(x0, y1);
      path.closePath();
    }

    return path;
  };

  private _initTrackMark() {
    this._trackMark = this._createMark(LinearProgressSeries.mark.track) as IRectMark;
    return this._trackMark;
  }

  private _initTrackMarkStyle() {
    const trackMark = this._trackMark;
    if (trackMark) {
      if (this._spec.direction === 'vertical') {
        this.setMarkStyle(
          trackMark,
          {
            x: (datum: any) => {
              return (
                valueInScaleRange(this.dataToPositionX(datum), this._xAxisHelper?.getScale?.(0), true) -
                this._spec.bandWidth / 2
              );
            },
            y: 0,
            width: this._spec.bandWidth,
            height: () => this._scaleY.range()[0],
            cornerRadius: this._spec.cornerRadius
          },
          'normal',
          AttributeLevel.Series
        );
      } else {
        this.setMarkStyle(
          trackMark,
          {
            x: 0,
            y: (datum: any) => {
              return (
                valueInScaleRange(this.dataToPositionY(datum), this._yAxisHelper?.getScale?.(0), true) -
                this._spec.bandWidth / 2
              );
            },
            height: this._spec.bandWidth,
            width: () => this._scaleX.range()[1],
            cornerRadius: this._spec.cornerRadius
          },
          'normal',
          AttributeLevel.Series
        );
      }
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

  initAnimation() {
    const animationParams: ILinearProgressAnimationParams = {
      direction: this.direction
    };

    const appearPreset = (this._spec?.animationAppear as IStateAnimateSpec<LinearProgressAppearPreset>)?.preset;

    this._progressMark.setAnimationConfig(
      animationConfig(
        Factory.getAnimationInKey('linearProgress')?.(animationParams, appearPreset),
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

  protected initTooltip() {
    this._tooltipHelper = new LinearProgressSeriesTooltipHelper(this);
    this._progressMark && this._tooltipHelper.activeTriggerSet.mark.add(this._progressMark);
    this._trackMark && this._tooltipHelper.activeTriggerSet.mark.add(this._trackMark);
  }

  getActiveMarks(): IMark[] {
    return [this._progressMark];
  }
}

export const registerLinearProgressSeries = () => {
  registerRectMark();
  registerLinearProgressAnimation();
  registerFadeInOutAnimation();
  Factory.registerSeries(LinearProgressSeries.type, LinearProgressSeries);
};
