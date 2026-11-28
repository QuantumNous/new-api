/* eslint-disable no-duplicate-imports */
import type { IMark, IPathMark, IRectMark } from '../../mark/interface';
import { MarkTypeEnum } from '../../mark/interface/type';
import { clamp, isValid, maxInArray, minInArray } from '@visactor/vutils';
import type { SeriesMarkMap } from '../interface';
import { SeriesMarkNameEnum, SeriesTypeEnum } from '../interface/type';
import type { IGaugePointerSeriesSpec, PinMarkSpec, PointerMarkSpec } from './interface';
import type { Datum } from '../../typings';
import { animationConfig, userAnimationConfig } from '../../animation/utils';
import { ProgressLikeSeries } from '../polar/progress-like';
import type { IStateAnimateSpec } from '../../animation/spec';
import { registerPathMark } from '../../mark/path';
import { registerRectMark } from '../../mark/rect';
import { gaugePointerSeriesMark } from './constant';
import { Factory } from '../../core/factory';
import { registerGaugePointerAnimation } from './animation';
import { GaugePointerSeriesSpecTransformer } from './gauge-pointer-transformer';
import { registerPolarBandAxis, registerPolarLinearAxis } from '../../component/axis/polar';
import { GaugePointerTooltipHelper } from './pointer-tooltip-helper';
import { gaugePointer } from '../../theme/builtin/common/series/gauge-pointer';

export class GaugePointerSeries<
  T extends IGaugePointerSeriesSpec = IGaugePointerSeriesSpec
> extends ProgressLikeSeries<T> {
  static readonly type: string = SeriesTypeEnum.gaugePointer;
  type = SeriesTypeEnum.gaugePointer;

  static readonly mark: SeriesMarkMap = gaugePointerSeriesMark;

  static readonly builtInTheme = { gaugePointer };
  static readonly transformerConstructor = GaugePointerSeriesSpecTransformer as any;
  readonly transformerConstructor = GaugePointerSeriesSpecTransformer;

  private _pinMark: IPathMark | null = null;
  private _pointerMark: IPathMark | IRectMark | null = null;
  private _pinBackgroundMark: IPathMark | null = null;

  protected _pointerType: MarkTypeEnum;

  setAttrFromSpec(): void {
    super.setAttrFromSpec();
    // 半径信息
    this.setRadiusField(this._spec.radiusField);

    this._pointerType = this._spec.pointer?.type === 'rect' ? MarkTypeEnum.rect : MarkTypeEnum.path;
  }

  initMark(): void {
    this._pinBackgroundMark = this._createMark(GaugePointerSeries.mark.pinBackground) as IPathMark;
    this._pointerMark = this._createMark(
      {
        ...GaugePointerSeries.mark.pointer,
        type: this._pointerType
      },
      {
        isSeriesMark: true
      }
    ) as IPathMark;
    this._pinMark = this._createMark(GaugePointerSeries.mark.pin) as IPathMark;
  }

  initMarkStyle(): void {
    this.initPinBackgroundMarkStyle();
    this.initPointerMarkStyle();
    this.initPinMarkStyle();
  }

  initGroups() {
    // do nothing
  }

  private initPointerMarkStyle() {
    const pointerMark = this._pointerMark;
    const pointerSpec = this._spec.pointer;
    if (pointerMark) {
      this.setMarkStyle(pointerMark, {
        x: (datum: Datum) => {
          const { x } = this._getPointerAnchor(datum, pointerSpec);
          const dx = this._getPointerWidth() * (pointerSpec?.center?.[0] ?? 0);
          return x - dx;
        },
        y: (datum: Datum) => {
          const { y } = this._getPointerAnchor(datum, pointerSpec);
          const dy = this._getPointerHeight(datum) * (pointerSpec?.center?.[1] ?? 0);
          return y - dy;
        },
        anchor: (datum: Datum) => {
          const { x, y } = this._getPointerAnchor(datum, pointerSpec);
          return [x, y];
        },
        fill: this.getColorAttribute(),
        zIndex: 200
      });
      if (this._pointerType === MarkTypeEnum.path) {
        this.setMarkStyle(pointerMark as IPathMark, {
          scaleX: this._getPointerWidth.bind(this),
          scaleY: this._getPointerHeight.bind(this),
          angle: (datum: Datum) => this._getPointerAngle(datum) + Math.PI / 2
        });
      } else {
        this.setMarkStyle(pointerMark as IRectMark, {
          width: this._getPointerWidth.bind(this),
          height: this._getPointerHeight.bind(this),
          angle: (datum: Datum) => this._getPointerAngle(datum) - Math.PI / 2
        });
      }
    }
  }

  protected initTooltip() {
    this._tooltipHelper = new GaugePointerTooltipHelper(this);

    this._pointerMark && this._tooltipHelper.activeTriggerSet.mark.add(this._pointerMark);
  }

  protected _getPointerAnchor(datum: Datum, markSpec: PinMarkSpec | PointerMarkSpec) {
    if (markSpec.isOnCenter ?? true) {
      return this.angleAxisHelper.center();
    }
    return this.radiusAxisHelper.coordToPoint({
      radius: this._innerRadius * this._computeLayoutRadius(),
      angle: this.angleAxisHelper.dataToPosition([datum[this._angleField[0]]])
    });
  }

  protected _getPointerWidth() {
    return this._spec.pointer.width * this._computeLayoutRadius();
  }

  protected _getPointerHeight(datum: Datum) {
    const pointerSpec = this._spec.pointer;
    const radiusField = this._radiusField[0];
    if (isValid(this.radiusAxisHelper) && isValid(radiusField)) {
      return (
        this.radiusAxisHelper.dataToPosition([datum[radiusField]]) -
        (pointerSpec?.innerPadding ?? 0) -
        (pointerSpec?.outerPadding ?? 10)
      );
    }
    return pointerSpec.height * this._computeLayoutRadius();
  }

  protected _getPointerAngle(datum: Datum) {
    const scale = this.angleAxisHelper.getScale();
    const domain = scale.domain();
    const max = maxInArray<number>(domain);
    const min = minInArray<number>(domain);
    const angle = clamp(datum[this._angleField[0]], min, max);
    return this.angleAxisHelper.dataToPosition([angle]);
  }

  protected _getRotatedPointerCenterOffset(datum: Datum) {
    const pointerSpec = this._spec.pointer;
    const x = this._getPointerWidth() * (pointerSpec?.center?.[0] ?? 0);
    const y = -this._getPointerHeight(datum) * (pointerSpec?.center?.[1] ?? 0);
    const angle = this._getPointerAngle(datum) - Math.PI / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x1 = x * cos + y * sin;
    const y1 = y * cos - x * sin;
    return {
      x: x1,
      y: -y1
    };
  }

  private initPinBackgroundMarkStyle() {
    const pinBackgroundMark = this._pinBackgroundMark;
    const pinBackgroundSpec = this._spec.pinBackground;
    if (pinBackgroundMark) {
      this.setMarkStyle(pinBackgroundMark, {
        x: (datum: Datum) => this._getPointerAnchor(datum, pinBackgroundSpec).x,
        y: (datum: Datum) => this._getPointerAnchor(datum, pinBackgroundSpec).y,
        scaleX: () => pinBackgroundSpec.width * this._computeLayoutRadius(),
        scaleY: () => pinBackgroundSpec.height * this._computeLayoutRadius(),
        fill: this.getColorAttribute(),
        zIndex: 100
      });
    }
  }

  private initPinMarkStyle() {
    const pinMark = this._pinMark;
    const pinSpec = this._spec.pin;
    if (pinMark) {
      this.setMarkStyle(pinMark, {
        x: (datum: Datum) => this._getPointerAnchor(datum, pinSpec).x,
        y: (datum: Datum) => this._getPointerAnchor(datum, pinSpec).y,
        scaleX: () => pinSpec.width * this._computeLayoutRadius(),
        scaleY: () => pinSpec.height * this._computeLayoutRadius(),
        fill: this.getColorAttribute(),
        zIndex: 300
      });
    }
  }

  getInteractionTriggers() {
    return this._parseInteractionConfig(this._pointerMark ? [this._pointerMark] : []);
  }

  initAnimation() {
    const appearPreset = (this._spec?.animationAppear as IStateAnimateSpec<any>)?.preset;

    this._pointerMark.setAnimationConfig(
      animationConfig(
        Factory.getAnimationInKey('gaugePointer')?.(
          {
            startAngle: this._startAngle
          },
          appearPreset
        ),
        userAnimationConfig(SeriesMarkNameEnum.pointer, this._spec, this._markAttributeContext)
      )
    );
  }

  getDefaultShapeType() {
    return 'circle';
  }

  getActiveMarks(): IMark[] {
    return [];
  }
}

export const registerGaugePointerSeries = () => {
  Factory.registerSeries(GaugePointerSeries.type, GaugePointerSeries);
  registerPathMark();
  registerRectMark();
  registerGaugePointerAnimation();
  registerPolarBandAxis();
  registerPolarLinearAxis();
};
