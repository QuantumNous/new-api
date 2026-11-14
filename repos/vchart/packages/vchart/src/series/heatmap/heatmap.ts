/* eslint-disable no-duplicate-imports */
import { registerCellMark } from './../../mark/cell';
import { CartesianSeries } from '../cartesian/cartesian';
import { AttributeLevel } from '../../constant/attribute';
import type { Datum } from '../../typings';
import { registerHeatmapAnimation } from './animation';
import { animationConfig, shouldMarkDoMorph, userAnimationConfig } from '../../animation/utils';
import type { HeatmapAppearPreset, IHeatmapSeriesSpec } from './interface';
import type { IAxisHelper } from '../../component/axis/cartesian/interface';
import { registerTextMark } from '../../mark/text';
import type { SeriesMarkMap } from '../interface';
import { SeriesMarkNameEnum, SeriesTypeEnum } from '../interface/type';
import type { IStateAnimateSpec } from '../../animation/spec';
import { normalizePadding, array } from '@visactor/vutils';
import { HeatmapSeriesTooltipHelper } from './tooltip-helper';
import { heatmapSeriesMark } from './constant';
import { Factory } from '../../core/factory';
import type { ICellMark, IMark, ITextMark } from '../../mark/interface';
import { getGroupAnimationParams } from '../util/utils';
import { HeatmapSeriesSpecTransformer } from './heatmap-transformer';
import { registerCartesianLinearAxis, registerCartesianBandAxis } from '../../component/axis/cartesian';
import { heatmap } from '../../theme/builtin/common/series/heatmap';
import type { ISeriesSpecUpdatePolicy } from '../base/base-series';

export const DefaultBandWidth = 6; // 默认的bandWidth，避免连续轴没有bandWidth

const HEATMAP_SERIES_DATA_RELATED_KEYS: Record<'valueField', true> = {
  valueField: true
};

export class HeatmapSeries<T extends IHeatmapSeriesSpec = IHeatmapSeriesSpec> extends CartesianSeries<T> {
  static readonly type: string = SeriesTypeEnum.heatmap;
  type = SeriesTypeEnum.heatmap;

  static readonly mark: SeriesMarkMap = heatmapSeriesMark;
  static readonly builtInTheme = { heatmap };
  static readonly transformerConstructor = HeatmapSeriesSpecTransformer as any;
  readonly transformerConstructor = HeatmapSeriesSpecTransformer;

  protected _cellMark: ICellMark;
  protected _backgroundMark: ICellMark;

  protected _fieldValue!: string[];
  getFieldValue() {
    return this._fieldValue;
  }
  setFieldValue(f: string | string[]) {
    this._fieldValue = array(f);
  }

  protected _getSpecUpdatePolicy(): ISeriesSpecUpdatePolicy {
    const policy = super._getSpecUpdatePolicy();
    return {
      ...policy,
      dataRelatedKeys: {
        ...policy.dataRelatedKeys,
        ...HEATMAP_SERIES_DATA_RELATED_KEYS
      }
    };
  }

  setAttrFromSpec() {
    super.setAttrFromSpec();
    this.setFieldValue(this._spec.valueField);
  }

  initMark(): void {
    this._cellMark = this._createMark(
      HeatmapSeries.mark.cell,
      {
        isSeriesMark: true
      },
      {
        morph: shouldMarkDoMorph(this._spec, HeatmapSeries.mark.cell.name),
        morphElementKey: this.getDimensionField()[0]
      }
    ) as ICellMark;

    this._backgroundMark = this._createMark(HeatmapSeries.mark.cellBackground) as ICellMark;
  }

  initMarkStyle(): void {
    this.initCellMarkStyle();
    this.initCellBackgroundMarkStyle();
  }

  initLabelMarkStyle(textMark: ITextMark) {
    if (!textMark) {
      return;
    }
    this.setMarkStyle(textMark, {
      fill: this._spec.cell?.style?.fill ?? this.getColorAttribute(),
      text: (datum: Datum) => {
        return datum[this.getMeasureField()[0]];
      }
    });
  }

  initCellMarkStyle() {
    this.setMarkStyle(
      this._cellMark,
      {
        x: (datum: Datum) => {
          const pos = this.dataToPositionX(datum);
          return pos;
        },
        y: (datum: Datum) => {
          const pos = this.dataToPositionY(datum);
          return pos;
        },
        size: () => {
          return [this.getCellSize(this._xAxisHelper), this.getCellSize(this._yAxisHelper)];
        },
        fill: this.getColorAttribute()
      },
      'normal',
      AttributeLevel.Series
    );
  }

  initCellBackgroundMarkStyle() {
    const padding = normalizePadding(this._spec.cellBackground?.style?.padding ?? 0);
    this.setMarkStyle(
      this._backgroundMark,
      {
        x: (datum: Datum) => {
          const width = this.getCellSize(this._xAxisHelper);
          const pos = this.dataToPositionX(datum);
          return pos - width / 2 + padding[3];
        },
        y: (datum: Datum) => {
          const height = this.getCellSize(this._yAxisHelper);
          const pos = this.dataToPositionY(datum);
          return pos - height / 2 + padding[0];
        },
        width: () => {
          return this.getCellSize(this._xAxisHelper) - padding[1] - padding[3];
        },
        height: () => {
          return this.getCellSize(this._yAxisHelper) - padding[0] - padding[2];
        }
      },
      'normal',
      AttributeLevel.Series
    );
  }

  /**
   * 获取默认颜色映射配置
   * 修复字段访问为 this.getFieldValue()[0]
   */
  getColorAttribute() {
    return {
      // TODO: 为热力图实现默认线性颜色 scale
      scale: this._option.globalScale.getScale('color') ?? this._getDefaultColorScale(),
      field: this.getFieldValue()[0]
    };
  }

  getInteractionTriggers() {
    return this._parseInteractionConfig(this._cellMark ? [this._cellMark] : []);
  }

  initAnimation() {
    const appearPreset = (this._spec?.animationAppear as IStateAnimateSpec<HeatmapAppearPreset>)?.preset;
    const animationParams = getGroupAnimationParams(this);

    this._cellMark.setAnimationConfig(
      animationConfig(
        Factory.getAnimationInKey('heatmap')?.(appearPreset),
        userAnimationConfig(SeriesMarkNameEnum.cell, this._spec, this._markAttributeContext),
        animationParams
      )
    );
  }

  protected getCellSize(axisHelper: IAxisHelper) {
    return axisHelper.getBandwidth?.(0) ?? DefaultBandWidth;
  }

  protected initTooltip() {
    this._tooltipHelper = new HeatmapSeriesTooltipHelper(this);
    this._cellMark && this._tooltipHelper.activeTriggerSet.mark.add(this._cellMark);
  }

  /**
   * 获取系列默认图元形状类型
   * 改为返回 'rect'，以与主题保持一致并支持非等宽高的热力图单元
   */
  getDefaultShapeType(): string {
    return 'rect';
  }

  getDimensionField(): string[] {
    return [].concat(this.fieldX, this.fieldY);
  }

  getMeasureField(): string[] {
    return this.getFieldValue();
  }

  getActiveMarks(): IMark[] {
    return [this._cellMark];
  }
}

export const registerHeatmapSeries = () => {
  registerTextMark();
  registerCellMark();
  registerHeatmapAnimation();
  registerCartesianBandAxis();
  registerCartesianLinearAxis();
  Factory.registerSeries(HeatmapSeries.type, HeatmapSeries);
};
