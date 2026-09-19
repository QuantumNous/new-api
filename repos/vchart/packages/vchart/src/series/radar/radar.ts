/* eslint-disable no-duplicate-imports */
import { LineLikeSeriesMixin } from '../mixin/line-mixin';
import type { IAreaMark, ILineMark, IMark, IMarkProgressiveConfig } from '../../mark/interface';
import { POLAR_START_RADIAN } from '../../constant/polar';
import { AttributeLevel } from '../../constant/attribute';
import { ChartEvent } from '../../constant/event';
import { DEFAULT_LINEAR_INTERPOLATE } from '../../typings/interpolate';
import type { Datum } from '../../typings';
import type { SeriesMarkMap } from '../interface';
import { SeriesMarkNameEnum, SeriesTypeEnum } from '../interface/type';
import { degreeToRadian, isArray, mixin, isValid } from '@visactor/vutils';
import type { IRadarAnimationParams, IRadarSeriesSpec, RadarAppearPreset } from './interface';
import { animationConfig, userAnimationConfig } from '../../animation/utils';
import { registerRadarAnimation } from './animation';
import { RoseLikeSeries } from '../polar/rose-like';
import type { IStateAnimateSpec } from '../../animation/spec';
import { registerAreaMark } from '../../mark/area';
import { registerLineMark } from '../../mark/line';
import { registerSymbolMark } from '../../mark/symbol';
import { radarSeriesMark } from './constant';
import { Factory } from '../../core/factory';
import { LineLikeSeriesSpecTransformer } from '../mixin/line-mixin-transformer';
import { registerPolarBandAxis, registerPolarLinearAxis } from '../../component/axis/polar';
import { radar } from '../../theme/builtin/common/series/radar';

export interface RadarSeries<T extends IRadarSeriesSpec>
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
      | 'addOverlapCompile'
    >,
    RoseLikeSeries<T> {}

export class RadarSeries<T extends IRadarSeriesSpec = IRadarSeriesSpec> extends RoseLikeSeries<T> {
  static readonly type: string = SeriesTypeEnum.radar;
  type = SeriesTypeEnum.radar;

  static readonly mark: SeriesMarkMap = radarSeriesMark;
  static readonly builtInTheme = { radar };
  static readonly transformerConstructor = LineLikeSeriesSpecTransformer as any;
  readonly transformerConstructor = LineLikeSeriesSpecTransformer;

  private _areaMark: ILineMark;
  protected _sortDataByAxis: boolean = false;

  initGroups() {
    // do nothing
  }

  compile(): void {
    super.compile();
    this.addOverlapCompile();
  }

  initMark(): void {
    const isAreaVisible = this._spec.area?.visible !== false && this._spec.area?.style?.visible !== false;
    const seriesMark = this._spec.seriesMark ?? 'area';
    this.initAreaMark(isAreaVisible && seriesMark === 'area');
    this.initLineMark(seriesMark === 'line' || (seriesMark === 'area' && !isAreaVisible));
    this.initSymbolMark(seriesMark === 'point');
  }

  initMarkStyle(): void {
    this.initAreaMarkStyle();
    this.initLineMarkStyle();
    this.initSymbolMarkStyle();
    [this._lineMark, this._symbolMark, this._areaMark].forEach(mark => {
      if (mark) {
        this.setMarkStyle(mark, {
          center: () => {
            return this.angleAxisHelper?.center();
          }
        });
      }
    });
  }

  initAreaMark(isSeriesMark: boolean) {
    this._areaMark = this._createMark(RadarSeries.mark.area, {
      groupKey: this._seriesField,
      isSeriesMark
    }) as IAreaMark;
  }

  initAreaMarkStyle() {
    const areaMark = this._areaMark;
    if (areaMark) {
      this.setMarkStyle(
        areaMark,
        {
          x: this.dataToPositionX.bind(this),
          y: this.dataToPositionY.bind(this),
          x1: (datum: Datum) => {
            if (!datum || !this.angleAxisHelper || !this.radiusAxisHelper) {
              return Number.NaN;
            }
            return this.valueToPosition(
              this.getDatumPositionValues(datum, this._angleField),
              this.getStack()
                ? this.getDatumPositionValues(datum, this._innerRadiusField)
                : this.radiusScale.domain()[0]
            ).x;
          },
          y1: (datum: Datum) => {
            if (!datum || !this.angleAxisHelper || !this.radiusAxisHelper) {
              return Number.NaN;
            }

            const value = this.valueToPosition(
              this.getDatumPositionValues(datum, this._angleField),
              this.getStack()
                ? this.getDatumPositionValues(datum, this._innerRadiusField)
                : this.radiusScale.domain()[0]
            ).y;
            return value;
          },
          fill: this.getColorAttribute(),
          curveType: DEFAULT_LINEAR_INTERPOLATE,
          closePath: true
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
      this.event.on(ChartEvent.viewDataStatisticsUpdate, { filter: param => param.model === this }, () => {
        this.encodeDefined(areaMark, 'defined');
      });
    }
  }

  protected initTooltip() {
    super.initTooltip();
    const { group, mark } = this._tooltipHelper.activeTriggerSet;
    if (this._lineMark) {
      group.add(this._lineMark);
    }
    if (this._areaMark) {
      group.add(this._areaMark);
    }
    if (this._symbolMark) {
      mark.add(this._symbolMark);
      group.add(this._symbolMark);
    }
  }

  initAnimation() {
    const animationParams: IRadarAnimationParams = {
      center: () => this.angleAxisHelper?.center(),
      radius: () => {
        const rect = this.getLayoutRect();
        return Math.min(rect.width, rect.height);
      },
      startAngle: isValid(this._spec.startAngle) ? degreeToRadian(this._spec.startAngle) : POLAR_START_RADIAN
    };
    const appearPreset = ((this._spec?.animationAppear as IStateAnimateSpec<RadarAppearPreset>)?.preset ??
      'clipIn') as RadarAppearPreset;

    if (appearPreset === 'clipIn') {
      if (this._rootMark) {
        this._rootMark.setAnimationConfig(
          animationConfig(
            Factory.getAnimationInKey('radarGroup')?.(animationParams, appearPreset),
            userAnimationConfig(SeriesMarkNameEnum.group, this._spec, this._markAttributeContext)
          )
        );
      }
    }

    // TODO: animationType
    const markAnimationMap: [IMark, string][] = [
      [this._areaMark, 'radar'],
      [this._lineMark, 'radar'],
      [this._symbolMark, 'radarSymbol']
    ];

    // 为 mark 添加动画
    markAnimationMap.forEach(([mark, animation]) => {
      if (isValid(mark)) {
        const getAnimation = Factory.getAnimationInKey(animation);
        mark.setAnimationConfig(
          animationConfig(
            getAnimation?.(animationParams, appearPreset),
            userAnimationConfig(mark.name, this._spec, this._markAttributeContext)
          )
        );
      }
    });
  }

  getDefaultShapeType() {
    return 'square';
  }

  getActiveMarks(): IMark[] {
    return [this._areaMark, this._symbolMark, this._lineMark];
  }

  getSeriesStyle(datum: Datum) {
    return (attribute: string) => {
      let result = this._seriesMark?.getAttribute(attribute as any, datum) ?? undefined;
      if (attribute === 'fill' && !result) {
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

mixin(RadarSeries, LineLikeSeriesMixin);

export const registerRadarSeries = () => {
  Factory.registerSeries(RadarSeries.type, RadarSeries);
  registerAreaMark();
  registerLineMark();
  registerSymbolMark();
  registerRadarAnimation();
  registerPolarBandAxis();
  registerPolarLinearAxis();
};
