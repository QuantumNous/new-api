/* eslint-disable no-duplicate-imports */
import type { Datum } from '../../typings';
import { valueInScaleRange } from '../../util/scale';
import { animationConfig, shouldMarkDoMorph, userAnimationConfig } from '../../animation/utils';
import type { SeriesMarkMap } from '../interface';
import { SeriesMarkNameEnum, SeriesTypeEnum } from '../interface/type';
import { registerRoseAnimation } from './animation';
import type { IRoseAnimationParams, IRoseSeriesSpec, RoseAppearPreset } from './interface';
import { RoseLikeSeries } from '../polar/rose-like';
import type { IStateAnimateSpec } from '../../animation/spec';
import { registerArcMark } from '../../mark/arc';
import { roseSeriesMark } from './constant';
import { Factory } from '../../core/factory';
import type { IArcMark, ILabelMark, IMark, ITextMark } from '../../mark/interface';
import { RoseSeriesSpecTransformer } from './rose-transformer';
import { registerPolarBandAxis, registerPolarLinearAxis } from '../../component/axis/polar';
import { rose } from '../../theme/builtin/common/series/rose';

export const DefaultBandWidth = 0.5;

export class RoseSeries<T extends IRoseSeriesSpec = IRoseSeriesSpec> extends RoseLikeSeries<T> {
  static readonly type: string = SeriesTypeEnum.rose;
  type = SeriesTypeEnum.rose;

  static readonly mark: SeriesMarkMap = roseSeriesMark;
  static readonly builtInTheme = { rose };
  static readonly transformerConstructor = RoseSeriesSpecTransformer as any;
  readonly transformerConstructor = RoseSeriesSpecTransformer;

  private _roseMark: IArcMark | null = null;
  protected _labelMark: ITextMark | null = null;

  initMark(): void {
    this.initRoseMark();
  }

  initMarkStyle(): void {
    this.initRoseMarkStyle();
  }

  protected _buildMarkAttributeContext() {
    super._buildMarkAttributeContext();
    // center
    this._markAttributeContext.getCenter = () => {
      return {
        x: () => this.angleAxisHelper.center().x,
        y: () => this.angleAxisHelper.center().y
      };
    };
    // angle scale
    this._markAttributeContext.startAngleScale = (datum: Datum) => this.startAngleScale(datum);
    this._markAttributeContext.endAngleScale = (datum: Datum) => this.endAngleScale(datum);
  }

  private initRoseMark() {
    this._roseMark = this._createMark(
      RoseSeries.mark.rose,
      {
        groupKey: this._seriesField,
        isSeriesMark: true
      },
      {
        morph: shouldMarkDoMorph(this._spec, RoseSeries.mark.rose.name),
        morphElementKey: this.getDimensionField()[0]
      }
    ) as IArcMark;
  }

  private getRoseAngle() {
    const angleBandWidth =
      this.angleAxisHelper.getBandwidth?.(this._groups ? this._groups.fields.length - 1 : 0) ?? DefaultBandWidth;
    return angleBandWidth;
  }

  private startAngleScale(datum: Datum) {
    return (
      this.angleAxisHelper.dataToPosition(this.getDatumPositionValues(datum, this.getGroupFields())) -
      this.angleAxisHelper.getBandwidth(this.getGroupFields().length - 1) * 0.5
    );
  }

  private endAngleScale(datum: Datum) {
    return (
      this.angleAxisHelper.dataToPosition(this.getDatumPositionValues(datum, this.getGroupFields())) +
      this.getRoseAngle() -
      this.angleAxisHelper.getBandwidth(this.getGroupFields().length - 1) * 0.5
    );
  }

  private initRoseMarkStyle() {
    const roseMark = this._roseMark;
    if (roseMark) {
      this.setMarkStyle(roseMark, {
        x: () => this.angleAxisHelper.center().x,
        y: () => this.angleAxisHelper.center().y,
        startAngle: (datum: Datum) => this.startAngleScale(datum),
        endAngle: (datum: Datum) => this.endAngleScale(datum),
        fill: this.getColorAttribute(),
        outerRadius: (datum: Datum) =>
          valueInScaleRange(
            this.radiusAxisHelper.dataToPosition([datum[this._radiusField[0]]]),
            this.radiusAxisHelper.getScale(0)
          ),
        innerRadius: (datum: Datum) => {
          if (!this.getStack()) {
            return 0;
          }
          const stackStart = valueInScaleRange(
            this.radiusAxisHelper.dataToPosition([datum[this._innerRadiusField[0]]]),
            this.radiusAxisHelper.getScale(0)
          );
          return stackStart <= Number.MIN_VALUE
            ? this._computeLayoutRadius() * (this._spec.innerRadius ?? 0)
            : stackStart;
        }
      });
    }
  }

  protected initTooltip() {
    super.initTooltip();

    this._roseMark && this._tooltipHelper.activeTriggerSet.mark.add(this._roseMark);
  }

  initLabelMarkStyle(textMark: ILabelMark) {
    if (!textMark) {
      return;
    }
    this.setMarkStyle(textMark, {
      text: (datum: Datum) => {
        return datum[this.getDimensionField()[0]];
      },
      fill: this.getColorAttribute(),
      z: 0
    });
  }

  initAnimation() {
    const appearPreset = (this._spec?.animationAppear as IStateAnimateSpec<RoseAppearPreset>)?.preset;

    if (this._roseMark) {
      const animationParams: IRoseAnimationParams = {
        innerRadius: () => this._computeLayoutRadius() * (this._spec.innerRadius ?? 0)
      };
      this._roseMark.setAnimationConfig(
        animationConfig(
          Factory.getAnimationInKey('rose')?.(animationParams, appearPreset),
          userAnimationConfig(SeriesMarkNameEnum.rose, this._spec, this._markAttributeContext)
        )
      );
    }
  }

  getDefaultShapeType() {
    return 'circle';
  }

  getActiveMarks(): IMark[] {
    return [this._roseMark];
  }
}

export const registerRoseSeries = () => {
  Factory.registerSeries(RoseSeries.type, RoseSeries);
  registerArcMark();
  registerRoseAnimation();
  registerPolarBandAxis();
  registerPolarLinearAxis();
};
