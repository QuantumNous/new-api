import type { ILineSeriesSpec } from '../../series/line/interface';
import type { IAreaSeriesSpec } from '../../series/area/interface';
import type { IChartSpec } from '../../typings/spec/common';
import type { IBarSeriesSpec } from '../../series/bar/interface';
import type { IRangeColumnChartSpec } from '../range-column/interface';
import type { IRangeAreaChartSpec } from '../range-area/interface';
import type { IDotSeriesSpec } from '../../series/dot/interface';
import type { IMapSeriesSpec } from '../../series/map/interface';
import type { IPieSeriesSpec } from '../../series/pie/interface';
import type { ILinkSeriesSpec } from '../../series/link/interface';
import type { IRadarSeriesSpec } from '../../series/radar/interface';
import type { IRoseSeriesSpec } from '../../series/rose/interface';
import type { IScatterSeriesSpec } from '../../series/scatter/interface';
import type { IWordCloudSeriesSpec } from '../../series/word-cloud/interface';
import type { IGaugePointerSeriesSpec, IGaugeSeriesSpec } from '../../series/gauge/interface';
import type { IBoxPlotSeriesSpec } from '../../series/box-plot/interface';
import type { ICirclePackingSeriesSpec } from '../../series/circle-packing/interface';
import type { IFunnelSeriesSpec } from '../../series/funnel/interface';
import type { IHeatmapSeriesSpec } from '../../series/heatmap/interface';
import type { ICircularProgressSeriesSpec } from '../../series/progress/circular/interface';
import type { ILinearProgressSeriesSpec } from '../../series/progress/linear/interface';
import type { ISankeySeriesSpec } from '../../series/sankey/interface';
import type { ISunburstSeriesSpec } from '../../series/sunburst/interface';
import type { ITreemapSeriesSpec } from '../../series/treemap/interface';
import type { IWaterfallSeriesSpec } from '../../series/waterfall/interface';
import type { ICorrelationSeriesSpec } from '../../series/correlation/interface';
import type { ICartesianAxisSpec } from '../../component/axis/cartesian/interface';
import type { IPolarAxisSpec } from '../../component/axis/polar/interface';
import type { ICartesianCrosshairSpec, IPolarCrosshairSpec } from '../../component/crosshair/interface';
import type { IMarkLineSpec } from '../../component/marker/mark-line/interface';
import type { IMarkAreaSpec } from '../../component/marker/mark-area/interface';
import type { IMarkPointSpec } from '../../component/marker/mark-point/interface';

export interface ICommonChartSpec extends Omit<IChartSpec, 'series'> {
  type: 'common';
  /**
   * 分组字段
   */
  seriesField?: string;
  series?: (
    | IAreaSeriesSpec
    | ILineSeriesSpec
    | IBarSeriesSpec
    | IRangeColumnChartSpec
    | IRangeAreaChartSpec
    | IDotSeriesSpec
    | IMapSeriesSpec
    | IPieSeriesSpec
    | ILinkSeriesSpec
    | IRadarSeriesSpec
    | IRoseSeriesSpec
    | IScatterSeriesSpec
    | ICircularProgressSeriesSpec
    | ILinearProgressSeriesSpec
    | IWordCloudSeriesSpec
    | IFunnelSeriesSpec
    | IBoxPlotSeriesSpec
    | IGaugeSeriesSpec
    | ISankeySeriesSpec
    | ITreemapSeriesSpec
    | ISunburstSeriesSpec
    | ICirclePackingSeriesSpec
    | IWaterfallSeriesSpec
    | IHeatmapSeriesSpec
    | IGaugePointerSeriesSpec
    | ICorrelationSeriesSpec
  )[];
  /**
   * 坐标轴配置
   */
  axes?: ICartesianAxisSpec[] | IPolarAxisSpec[];
  /**
   * 十字辅助线配置
   */
  crosshair?: ICartesianCrosshairSpec | ICartesianCrosshairSpec[] | IPolarCrosshairSpec | IPolarCrosshairSpec[];
  /**
   * **仅适用于笛卡尔坐标系**，参考线配置
   */
  markLine?: IMarkLineSpec | IMarkLineSpec[];
  /**
   * **仅适用于笛卡尔坐标系**，参考区域配置
   */
  markArea?: IMarkAreaSpec | IMarkAreaSpec[];
  /**
   * **仅适用于笛卡尔坐标系**，参考点配置
   */
  markPoint?: IMarkPointSpec | IMarkPointSpec[];

  /**
   * 是否开启自动 bandSize。如果开启，会根据传入的 barWidth 等配置自动计算 bandSize，从而影响轴实际长度
   * @since 1.11.2
   */
  autoBandSize?:
    | boolean
    | {
        /** 设置 bandSize 的在自动计算结果基础上的扩增值，单位为 px */
        extend: number;
      };
}
