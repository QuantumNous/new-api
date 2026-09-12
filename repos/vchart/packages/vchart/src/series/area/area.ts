import type { DataView } from '@visactor/vdataset';
import { isArray } from '@visactor/vutils';
/* eslint-disable no-duplicate-imports */
import { LINE_LIKE_SERIES_DATA_RELATED_KEYS, LineLikeSeriesMixin } from '../mixin/line-mixin';
import { Direction } from '../../typings/space';
import { CartesianSeries } from '../cartesian/cartesian';
import { AttributeLevel } from '../../constant/attribute';
import type { Datum, InterpolateType } from '../../typings';
import { valueInScaleRange } from '../../util/scale';
import type { SeriesMarkMap } from '../interface';
import { SeriesMarkNameEnum, SeriesTypeEnum } from '../interface/type';
import { mixin } from '@visactor/vutils';
import { animationConfig, userAnimationConfig } from '../../animation/utils';
import { DEFAULT_SMOOTH_INTERPOLATE } from '../../typings/interpolate';
import type { IAreaSeriesSpec, IAreaSeriesTheme } from './interface';
import type { IMarkAnimateSpec } from '../../animation/spec';
import { registerLineMark } from '../../mark/line';
import { registerAreaMark } from '../../mark/area';
import { registerSymbolMark } from '../../mark/symbol';
import { AreaSeriesTooltipHelper } from './tooltip-helpter';
import { areaSeriesMark } from './constant';
import { Factory } from '../../core/factory';
import { registerAreaSeriesAnimation } from './animation';
import type { IMark, IAreaMark } from '../../mark/interface';
import { AreaSeriesSpecTransformer } from './area-transformer';
import { getGroupAnimationParams } from '../util/utils';
import { registerCartesianLinearAxis, registerCartesianBandAxis } from '../../component/axis/cartesian';
import { STACK_FIELD_END } from '../../constant/data';
import { registerSymbolOverlapTransform } from '../../mark/transform/symbol-overlap';
import { registerDataSamplingTransform } from '../../mark/transform/data-sampling';
import { area } from '../../theme/builtin/common/series/area';
import type { ISeriesSpecUpdatePolicy } from '../base/base-series';

export interface AreaSeries<T extends IAreaSeriesSpec = IAreaSeriesSpec>
  extends Pick<
      LineLikeSeriesMixin,
      | 'initLineMark'
      | 'initSymbolMark'
      | 'initLabelMarkStyle'
      | 'initLineMarkStyle'
      | 'initSymbolMarkStyle'
      | 'encodeDefined'
      | '_lineMark'
      | '_symbolMark'
      | 'addSamplingCompile'
      | 'addOverlapCompile'
      | 'reCompileSampling'
      | 'initLineLabelMarkStyle'
    >,
    CartesianSeries<T> {}

export class AreaSeries<T extends IAreaSeriesSpec = IAreaSeriesSpec> extends CartesianSeries<T> {
  static readonly type: string = SeriesTypeEnum.area;
  type = SeriesTypeEnum.area;

  static readonly builtInTheme: Record<string, IAreaSeriesTheme> = { area };
  static readonly mark: SeriesMarkMap = areaSeriesMark;
  static readonly transformerConstructor = AreaSeriesSpecTransformer as any;
  readonly transformerConstructor = AreaSeriesSpecTransformer;

  protected _areaMark!: IAreaMark;
  protected _sortDataByAxis: boolean = false;

  protected _getSpecUpdatePolicy(): ISeriesSpecUpdatePolicy {
    const policy = super._getSpecUpdatePolicy();
    return {
      ...policy,
      dataRelatedKeys: {
        ...policy.dataRelatedKeys,
        ...LINE_LIKE_SERIES_DATA_RELATED_KEYS
      }
    };
  }

  initMark(): void {
    const seriesMark = this._spec.seriesMark ?? 'area';
    const isAreaMarkVisible = this._isAreaVisible() || this._isLineVisible();
    // area
    this._areaMark = this._createMark(
      AreaSeries.mark.area,
      {
        groupKey: this._seriesField,
        isSeriesMark: isAreaMarkVisible && seriesMark !== 'point'
      },
      {
        morphElementKey: this.getDimensionField()[0]
      }
    ) as IAreaMark;

    this.initSymbolMark(seriesMark === 'point');
  }

  initMarkStyle(): void {
    this.initAreaMarkStyle();
    this.initSymbolMarkStyle();
  }

  initAreaMarkStyle() {
    // FIXME 是不是应该把curveType提前到上层配置
    // 不允许area和line的curveType不一致
    const userCurveType = (this.getSpec().area?.style?.curveType ??
      this.getSpec().line?.style?.curveType) as InterpolateType;
    const curveType =
      userCurveType === DEFAULT_SMOOTH_INTERPOLATE
        ? this._direction === Direction.horizontal
          ? 'monotoneY'
          : 'monotoneX'
        : userCurveType;

    // area
    const areaMark = this._areaMark;
    if (areaMark) {
      const isAreaVisible = this._isAreaVisible();
      const isLineVisible = this._isLineVisible();
      if (isAreaVisible || isLineVisible) {
        areaMark.setVisible(true);
      } else {
        areaMark.setVisible(false);
      }

      if (this._direction === Direction.horizontal) {
        this.setMarkStyle(
          this._areaMark,
          {
            x: this.dataToPositionX.bind(this),
            x1: (datum: Datum) => {
              return valueInScaleRange(this.dataToPositionX1(datum), this._xAxisHelper?.getScale?.(0));
            },
            y: this.dataToPositionY.bind(this),
            y1: this.dataToPositionY.bind(this),
            z: this._fieldZ ? this.dataToPositionZ.bind(this) : null,
            orient: this._direction
          },
          'normal',
          AttributeLevel.Series
        );
      } else {
        this.setMarkStyle(
          this._areaMark,
          {
            x: this.dataToPositionX.bind(this),
            x1: this.dataToPositionX.bind(this),
            y1: (datum: Datum) => {
              return valueInScaleRange(this.dataToPositionY1(datum), this._yAxisHelper?.getScale?.(0));
            },
            y: this.dataToPositionY.bind(this),
            z: this._fieldZ ? this.dataToPositionZ.bind(this) : null
          },
          'normal',
          AttributeLevel.Series
        );
      }
      this.setMarkStyle(
        areaMark,
        {
          fill: isAreaVisible ? this.getColorAttribute() : false,
          stroke: isLineVisible ? this.getColorAttribute() : false
        },
        'normal',
        AttributeLevel.Series
      );

      if (this._invalidType !== 'zero') {
        this.setMarkStyle(
          areaMark,
          {
            defined: this._getInvalidDefined.bind(this),
            connectedType: this._getInvalidConnectType()
          },
          'normal',
          AttributeLevel.Series
        );
      }

      if (this.getStack()) {
        // 在堆叠情况下面积系列需要控制图元层级，https://github.com/VisActor/VChart/issues/3684
        this.setMarkStyle(
          areaMark,
          {
            zIndex: (datum: Datum) => -datum[STACK_FIELD_END] // 越在堆叠下层，datum[STACK_FIELD_END] 越小,  zIndex越大
          },
          'normal',
          AttributeLevel.Series
        );
      }

      this.setMarkStyle(
        areaMark,
        {
          curveType
        },
        'normal',
        AttributeLevel.Built_In
      );

      // change stroke to area stoke = [lineStroke,false,false,false]
      Object.keys(areaMark.stateStyle).forEach(state => {
        if (areaMark.stateStyle[state].stroke) {
          areaMark.setPostProcess(
            'stroke',
            result => {
              return [result, false, false, false];
            },
            state
          );
        }
      });
    }
  }

  initAnimation() {
    const areaAnimationParams = { direction: this.direction };
    const appearPreset = (this._spec.animationAppear as IMarkAnimateSpec<string>)?.preset;
    if (this._lineMark) {
      this._lineMark.setAnimationConfig(
        animationConfig(
          Factory.getAnimationInKey('line')?.(areaAnimationParams, appearPreset),
          userAnimationConfig(SeriesMarkNameEnum.line, this._spec, this._markAttributeContext)
        )
      );
    }

    if (this._areaMark) {
      this._areaMark.setAnimationConfig(
        animationConfig(
          Factory.getAnimationInKey('area')?.(areaAnimationParams, appearPreset),
          userAnimationConfig(SeriesMarkNameEnum.area, this._spec, this._markAttributeContext)
        )
      );
    }

    if (this._symbolMark) {
      const animationParams = getGroupAnimationParams(this);
      this._symbolMark.setAnimationConfig(
        animationConfig(
          Factory.getAnimationInKey('scaleInOut')?.(),
          userAnimationConfig(SeriesMarkNameEnum.point, this._spec, this._markAttributeContext),
          animationParams
        )
      );
    }
  }

  protected _isAreaVisible() {
    const areaSpec = this._spec.area || {};
    return areaSpec.visible !== false && areaSpec.style?.visible !== false;
  }

  protected _isLineVisible() {
    const lineSpec = this._spec.line || {};
    return lineSpec.visible !== false && lineSpec.style?.visible !== false;
  }

  protected initTooltip() {
    this._tooltipHelper = new AreaSeriesTooltipHelper(this);
    const { group, mark } = this._tooltipHelper.activeTriggerSet;
    if (this._areaMark) {
      group.add(this._areaMark);
    }
    if (this._lineMark) {
      group.add(this._lineMark);
    }
    if (this._symbolMark) {
      mark.add(this._symbolMark);
      group.add(this._symbolMark);
    }
  }

  viewDataStatisticsUpdate(d: DataView) {
    super.viewDataStatisticsUpdate(d);
    this.encodeDefined(this._areaMark, 'defined');
  }

  compile(): void {
    super.compile();
    this.addSamplingCompile();
    this.addOverlapCompile();
  }

  getDefaultShapeType() {
    return 'square';
  }

  getActiveMarks(): IMark[] {
    return [this._areaMark, this._symbolMark, this._lineMark];
  }

  onLayoutEnd(): void {
    super.onLayoutEnd();
    this.reCompileSampling();
  }

  getSeriesStyle(datum: Datum) {
    return (attribute: string) => {
      const seriesMarkType = this._spec.seriesMark ?? 'area';

      let result = this._seriesMark?.getAttribute(attribute as any, datum) ?? undefined;
      if (attribute === 'fill' && (!result || seriesMarkType === 'line')) {
        attribute = 'stroke';
        result = this._seriesMark?.getAttribute(attribute, datum) ?? undefined;
      }
      if (attribute === 'stroke' && isArray(result)) {
        return result[0];
      }
      return result;
    };
  }
}

mixin(AreaSeries, LineLikeSeriesMixin);

export const registerAreaSeries = () => {
  registerDataSamplingTransform();
  registerSymbolOverlapTransform();
  registerLineMark();
  registerAreaMark();
  registerSymbolMark();
  registerAreaSeriesAnimation();
  registerCartesianBandAxis();
  registerCartesianLinearAxis();
  Factory.registerSeries(AreaSeries.type, AreaSeries);
};
