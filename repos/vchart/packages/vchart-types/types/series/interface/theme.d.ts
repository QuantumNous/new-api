import type { IWaterfallSeriesTheme } from '../waterfall/interface';
import type { IBoxPlotSeriesTheme } from '../box-plot/interface';
import type { IBarSeriesTheme } from '../bar/interface';
import type { ILineSeriesTheme } from '../line/interface';
import type { IScatterSeriesTheme } from '../scatter/interface';
import type { IAreaSeriesTheme } from '../area/interface';
import type { IRadarSeriesTheme } from '../radar/interface';
import type { IPieSeriesTheme } from '../pie/interface';
import type { IRoseSeriesTheme } from '../rose/interface';
import type { IMapSeriesTheme } from '../map/interface';
import type { ICircularProgressSeriesTheme } from '../progress/circular/interface';
import type { ILinkSeriesTheme } from '../link/interface';
import type { IDotSeriesTheme } from '../dot/interface';
import type { IWordCloudSeriesTheme } from '../word-cloud/interface';
import type { IFunnelSeriesTheme } from '../funnel/interface';
import type { ILinearProgressSeriesTheme } from '../progress/linear/interface';
import type { IGaugePointerSeriesTheme, IGaugeSeriesTheme } from '../gauge/interface';
import type { ISankeySeriesTheme } from '../sankey/interface';
import type { ITreemapSeriesTheme } from '../treemap/interface';
import type { ISunburstSeriesTheme } from '../sunburst/interface';
import type { IRangeColumnSeriesTheme } from '../range-column/interface';
import type { ICirclePackingSeriesTheme } from '../circle-packing/interface';
import type { IHeatmapSeriesTheme } from '../heatmap/interface';
import type { ICorrelationSeriesTheme } from '../correlation/interface';
import type { SeriesTypeEnum } from './type';
import type { IRangeAreaSeriesTheme } from '../range-area/interface';
import type { ILiquidSeriesTheme } from '../liquid/interface';
import type { IVennSeriesTheme } from '../venn/interface';
import type { IMosaicSeriesTheme } from '../mosaic/interface';
export interface ISeriesTheme {
    [SeriesTypeEnum.bar]?: IBarSeriesTheme;
    [SeriesTypeForThemeEnum.bar_vertical]?: IBarSeriesTheme;
    [SeriesTypeForThemeEnum.bar_horizontal]?: IBarSeriesTheme;
    [SeriesTypeForThemeEnum.bar_stack]?: IBarSeriesTheme;
    [SeriesTypeEnum.line]?: ILineSeriesTheme;
    [SeriesTypeForThemeEnum.line_vertical]?: ILineSeriesTheme;
    [SeriesTypeForThemeEnum.line_horizontal]?: ILineSeriesTheme;
    [SeriesTypeForThemeEnum.line_stack]?: ILineSeriesTheme;
    [SeriesTypeEnum.area]?: IAreaSeriesTheme;
    [SeriesTypeForThemeEnum.area_vertical]?: IAreaSeriesTheme;
    [SeriesTypeForThemeEnum.area_horizontal]?: IAreaSeriesTheme;
    [SeriesTypeForThemeEnum.area_stack]?: IAreaSeriesTheme;
    [SeriesTypeEnum.rangeColumn]?: IRangeColumnSeriesTheme;
    [SeriesTypeForThemeEnum.rangeColumn_vertical]?: IRangeColumnSeriesTheme;
    [SeriesTypeForThemeEnum.rangeColumn_horizontal]?: IRangeColumnSeriesTheme;
    [SeriesTypeEnum.rangeArea]?: IRangeAreaSeriesTheme;
    [SeriesTypeForThemeEnum.rangeArea_vertical]?: IRangeAreaSeriesTheme;
    [SeriesTypeForThemeEnum.rangeArea_horizontal]?: IRangeAreaSeriesTheme;
    [SeriesTypeEnum.linearProgress]?: ILinearProgressSeriesTheme;
    [SeriesTypeForThemeEnum.linearProgress_vertical]?: ILinearProgressSeriesTheme;
    [SeriesTypeForThemeEnum.linearProgress_horizontal]?: ILinearProgressSeriesTheme;
    [SeriesTypeForThemeEnum.linearProgress_stack]?: ILinearProgressSeriesTheme;
    [SeriesTypeEnum.boxPlot]?: IBoxPlotSeriesTheme;
    [SeriesTypeForThemeEnum.boxPlot_vertical]?: IBoxPlotSeriesTheme;
    [SeriesTypeForThemeEnum.boxPlot_horizontal]?: IBoxPlotSeriesTheme;
    [SeriesTypeEnum.sankey]?: ISankeySeriesTheme;
    [SeriesTypeForThemeEnum.sankey_vertical]?: ISankeySeriesTheme;
    [SeriesTypeForThemeEnum.sankey_horizontal]?: ISankeySeriesTheme;
    [SeriesTypeEnum.waterfall]?: IWaterfallSeriesTheme;
    [SeriesTypeForThemeEnum.waterfall_vertical]?: IWaterfallSeriesTheme;
    [SeriesTypeForThemeEnum.waterfall_horizontal]?: IWaterfallSeriesTheme;
    [SeriesTypeEnum.scatter]?: IScatterSeriesTheme;
    [SeriesTypeEnum.radar]?: IRadarSeriesTheme;
    [SeriesTypeForThemeEnum.radar_stack]?: IRadarSeriesTheme;
    [SeriesTypeEnum.pie]?: IPieSeriesTheme;
    [SeriesTypeEnum.rose]?: IRoseSeriesTheme;
    [SeriesTypeForThemeEnum.rose_stack]?: IRoseSeriesTheme;
    [SeriesTypeEnum.map]?: IMapSeriesTheme;
    [SeriesTypeEnum.circularProgress]?: ICircularProgressSeriesTheme;
    [SeriesTypeForThemeEnum.circularProgress_stack]?: ICircularProgressSeriesTheme;
    [SeriesTypeEnum.link]?: ILinkSeriesTheme;
    [SeriesTypeEnum.dot]?: IDotSeriesTheme;
    [SeriesTypeEnum.wordCloud]?: IWordCloudSeriesTheme;
    [SeriesTypeEnum.funnel]?: IFunnelSeriesTheme;
    [SeriesTypeEnum.treemap]?: ITreemapSeriesTheme;
    [SeriesTypeEnum.gauge]?: IGaugeSeriesTheme;
    [SeriesTypeEnum.gaugePointer]?: IGaugePointerSeriesTheme;
    [SeriesTypeEnum.sunburst]?: ISunburstSeriesTheme;
    [SeriesTypeEnum.circlePacking]?: ICirclePackingSeriesTheme;
    [SeriesTypeEnum.heatmap]?: IHeatmapSeriesTheme;
    [SeriesTypeEnum.correlation]?: ICorrelationSeriesTheme;
    [SeriesTypeEnum.liquid]?: ILiquidSeriesTheme;
    [SeriesTypeEnum.venn]?: IVennSeriesTheme;
    [SeriesTypeEnum.mosaic]?: IMosaicSeriesTheme;
    [key: string]: any;
}
export declare enum SeriesTypeForThemeEnum {
    area_horizontal = "area_horizontal",
    area_vertical = "area_vertical",
    area_stack = "area_stack",
    line_horizontal = "line_horizontal",
    line_vertical = "line_vertical",
    line_stack = "line_stack",
    bar_horizontal = "bar_horizontal",
    bar_vertical = "bar_vertical",
    bar_stack = "bar_stack",
    rangeColumn_horizontal = "rangeColumn_horizontal",
    rangeColumn_vertical = "rangeColumn_vertical",
    rangeArea_horizontal = "rangeArea_horizontal",
    rangeArea_vertical = "rangeArea_vertical",
    linearProgress_horizontal = "linearProgress_horizontal",
    linearProgress_vertical = "linearProgress_vertical",
    linearProgress_stack = "linearProgress_stack",
    boxPlot_horizontal = "boxPlot_horizontal",
    boxPlot_vertical = "boxPlot_vertical",
    sankey_horizontal = "sankey_horizontal",
    sankey_vertical = "sankey_vertical",
    waterfall_horizontal = "waterfall_horizontal",
    waterfall_vertical = "waterfall_vertical",
    circularProgress_stack = "circularProgress_stack",
    radar_stack = "radar_stack",
    rose_stack = "rose_stack"
}
