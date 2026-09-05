import { BarSeries } from '../bar/bar';
import { MarkTypeEnum } from '../../mark/interface/type';
import type { SeriesMarkMap } from '../interface';
// eslint-disable-next-line no-duplicate-imports
import { SeriesMarkNameEnum, SeriesTypeEnum } from '../interface/type';
import { Direction } from '../../typings/space';
// eslint-disable-next-line no-duplicate-imports
import { registerRectMark } from '../../mark/rect';
// eslint-disable-next-line no-duplicate-imports
import { registerTextMark } from '../../mark/text';
import { setRectLabelPos } from '../util/label-mark';
import { animationConfig, shouldMarkDoMorph, userAnimationConfig } from '../../animation/utils';
import { RangeColumnSeriesTooltipHelper } from './tooltip-helper';
import { registerFadeInOutAnimation } from '../../animation/config';
import type { Datum } from '../../typings';
import type { IRangeColumnSeriesSpec } from './interface';
// eslint-disable-next-line no-duplicate-imports
import { PositionEnum } from './interface';
import type { IStateAnimateSpec } from '../../animation/spec';
import type { RangeColumnAppearPreset } from './interface';
// eslint-disable-next-line no-duplicate-imports
import { registerRangeColumnAnimation } from './animation';
import { rangeColumnSeriesMark } from './constant';
import { Factory } from '../../core/factory';
import { getGroupAnimationParams } from '../util/utils';
import { RangeColumnSeriesSpecTransformer } from './range-column-transformer';
import { registerCartesianLinearAxis, registerCartesianBandAxis } from '../../component/axis/cartesian';
import type { IRectMark, ITextMark } from '../../mark/interface';
import { rangeColumn } from '../../theme/builtin/common/series/rangeColumn';

export const DefaultBandWidth = 6; // 默认的bandWidth，避免连续轴没有bandWidth

export class RangeColumnSeries<T extends IRangeColumnSeriesSpec = IRangeColumnSeriesSpec> extends BarSeries<any> {
  static readonly type: string = SeriesTypeEnum.rangeColumn;
  type: string = SeriesTypeEnum.rangeColumn;
  protected _barMarkType: string = MarkTypeEnum.rect;
  protected _barName: string = SeriesTypeEnum.bar;

  protected declare _spec: T;

  static readonly mark: SeriesMarkMap = rangeColumnSeriesMark;
  static readonly builtInTheme = { rangeColumn };
  static readonly transformerConstructor = RangeColumnSeriesSpecTransformer as any;
  readonly transformerConstructor = RangeColumnSeriesSpecTransformer as any;

  private _minLabelMark?: ITextMark;
  private _maxLabelMark?: ITextMark;
  private _labelMark?: ITextMark;

  initMark(): void {
    this._initBarBackgroundMark();

    const labelPosition = this._spec.label?.position;
    this._barMark = this._createMark(
      RangeColumnSeries.mark.bar,
      {
        groupKey: this._seriesField,
        isSeriesMark: true
      },
      {
        morph: shouldMarkDoMorph(this._spec, RangeColumnSeries.mark.bar.name),
        morphElementKey: this.getDimensionField()[0]
      }
    ) as IRectMark;

    if (this._spec.label?.visible !== false && labelPosition === PositionEnum.bothEnd) {
      if (this._spec.label?.minLabel?.visible !== false) {
        this._minLabelMark = this._createMark(RangeColumnSeries.mark.minLabel, {
          markSpec: this._spec.label?.minLabel
        }) as ITextMark;
      }
      if (this._spec.label?.maxLabel?.visible !== false) {
        this._maxLabelMark = this._createMark(RangeColumnSeries.mark.maxLabel, {
          markSpec: this._spec.label?.maxLabel
        }) as ITextMark;
      }
    }
  }

  initMarkStyle(): void {
    super.initMarkStyle();
    this._initLabelMarkPos(this._minLabelMark, this._spec.label?.minLabel, 0, 'end');
    this._initLabelMarkPos(this._maxLabelMark, this._spec.label?.maxLabel, 1, 'start');
  }

  _initLabelMarkPos(
    labelMark: ITextMark,
    labelSpec: IRangeColumnSeriesSpec['label']['minLabel'],
    fieldIndex: number,
    defaultPosition: string
  ): void {
    if (labelMark) {
      this.setMarkStyle(labelMark, {
        fill: labelSpec?.style?.fill ?? this.getColorAttribute(),
        text: (datum: Datum) => {
          const val =
            this._spec.direction === Direction.horizontal
              ? datum[this._spec.xField[fieldIndex]]
              : datum[this._spec.yField[fieldIndex]];
          if (labelSpec?.formatMethod) {
            return labelSpec.formatMethod(val, datum);
          }
          return val;
        }
      });
      const position = labelSpec?.position ?? defaultPosition;
      const offset = labelSpec?.offset ?? (this._direction === 'vertical' ? -20 : -25);
      setRectLabelPos(
        this,
        labelMark,
        position,
        offset,
        (datum: Datum) => this._barMark.getAttribute('x', datum) as number,
        (datum: Datum) => {
          return this._direction === 'vertical'
            ? (this._barMark.getAttribute('x', datum) as number) +
                (this._barMark.getAttribute('width', datum) as number)
            : (this._barMark.getAttribute('x1', datum) as number);
        },
        (datum: Datum) => this._barMark.getAttribute('y', datum) as number,
        (datum: Datum) => {
          return this._direction === 'vertical'
            ? (this._barMark.getAttribute('y1', datum) as number)
            : (this._barMark.getAttribute('y', datum) as number) +
                (this._barMark.getAttribute('height', datum) as number);
        },
        () => this._direction
      );
    }
  }

  initLabelMarkStyle(labelMark: ITextMark): void {
    if (!labelMark) {
      return;
    }
    this.setMarkStyle(labelMark, {
      text: (datum: Datum) => {
        let min;
        let max;
        if (this._spec.direction === Direction.horizontal) {
          min = datum[this._spec.xField[0]];
          max = datum[this._spec.xField[1]];
        } else {
          min = datum[this._spec.yField[0]];
          max = datum[this._spec.yField[1]];
        }
        return min + '-' + max;
      },
      z: this._fieldZ ? this.dataToPositionZ.bind(this) : null
    });
    this._labelMark = labelMark;
  }

  protected _dataToPosX(datum: Datum) {
    return this._xAxisHelper.dataToPosition(this.getDatumPositionValues(datum, this._spec.xField[0]), {
      bandPosition: this._bandPosition
    });
  }

  protected _dataToPosX1(datum: Datum) {
    return this._xAxisHelper.dataToPosition(this.getDatumPositionValues(datum, this._spec.xField[1]), {
      bandPosition: this._bandPosition
    });
  }

  protected _dataToPosY(datum: Datum) {
    return this._yAxisHelper.dataToPosition(this.getDatumPositionValues(datum, this._spec.yField[0]), {
      bandPosition: this._bandPosition
    });
  }

  protected _dataToPosY1(datum: Datum) {
    return this._yAxisHelper.dataToPosition(this.getDatumPositionValues(datum, this._spec.yField[1]), {
      bandPosition: this._bandPosition
    });
  }

  initAnimation() {
    const animationParams = getGroupAnimationParams(this);

    const appearPreset = (this._spec?.animationAppear as IStateAnimateSpec<RangeColumnAppearPreset>)?.preset;
    this._barMark.setAnimationConfig(
      animationConfig(
        Factory.getAnimationInKey('rangeColumn')?.({ direction: this.direction }, appearPreset),
        userAnimationConfig(SeriesMarkNameEnum.bar, this._spec, this._markAttributeContext),
        animationParams
      )
    );

    if (this._minLabelMark) {
      this._minLabelMark.setAnimationConfig(
        animationConfig(
          Factory.getAnimationInKey('fadeInOut')?.(),
          userAnimationConfig(SeriesMarkNameEnum.label, this._spec, this._markAttributeContext),
          animationParams
        )
      );
    }

    if (this._maxLabelMark) {
      this._maxLabelMark.setAnimationConfig(
        animationConfig(
          Factory.getAnimationInKey('fadeInOut')?.(),
          userAnimationConfig(SeriesMarkNameEnum.label, this._spec, this._markAttributeContext),
          animationParams
        )
      );
    }
  }

  protected initTooltip() {
    this._tooltipHelper = new RangeColumnSeriesTooltipHelper(this);
    this._barMark && this._tooltipHelper.activeTriggerSet.mark.add(this._barMark);

    this._minLabelMark && this._tooltipHelper.ignoreTriggerSet.mark.add(this._minLabelMark);
    this._maxLabelMark && this._tooltipHelper.ignoreTriggerSet.mark.add(this._maxLabelMark);
    this._labelMark && this._tooltipHelper.ignoreTriggerSet.mark.add(this._labelMark);
  }
}

export const registerRangeColumnSeries = () => {
  registerRectMark();
  registerTextMark();
  registerRangeColumnAnimation();
  registerFadeInOutAnimation();
  registerCartesianBandAxis();
  registerCartesianLinearAxis();
  Factory.registerSeries(RangeColumnSeries.type, RangeColumnSeries);
};
