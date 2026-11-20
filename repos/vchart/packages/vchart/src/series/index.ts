/* eslint-disable no-duplicate-imports */
/**
 * @description export all mark modules
 */
import { WaterfallSeries, registerWaterfallSeries } from './waterfall/waterfall';
import type { IWaterfallSeriesSpec } from './waterfall/interface';
import { BoxPlotSeries, registerBoxplotSeries } from './box-plot/box-plot';
import type { IBoxPlotSeriesSpec } from './box-plot/interface';
import { LineSeries, registerLineSeries } from './line/line';
import type { ILineSeriesSpec } from './line/interface';
import { BarSeries, registerBarSeries } from './bar/bar';
import type { BarAppearPreset, IBarAnimationParams, IBarSeriesSpec } from './bar/interface';
import { BarSeriesSpecTransformer } from './bar/bar-transformer';
import { RangeColumnSeries, registerRangeColumnSeries } from './range-column/range-column';
import type { IRangeColumnSeriesSpec, IRangeColumnSeriesTheme } from './range-column/interface';
import { PositionEnum } from './range-column/interface';
import { RangeAreaSeries, registerRangeAreaSeries } from './range-area/range-area';
import type { IRangeAreaSeriesSpec } from './range-area/interface';
import { MapSeries, registerMapSeries } from './map/map';
import type { IMapSeriesSpec } from './map/interface';
import { BasePieSeries, PieSeries, registerPieSeries } from './pie/pie';
import type { IArcLabelSpec, IPieAnimationParams, IPieSeriesSpec, PieAppearPreset } from './pie/interface';
import { ScatterSeries, registerScatterSeries } from './scatter/scatter';
import type { IScatterSeriesSpec } from './scatter/interface';
import { RoseSeries, registerRoseSeries } from './rose/rose';
import type { IRoseSeriesSpec } from './rose/interface';
import { RadarSeries, registerRadarSeries } from './radar/radar';
import type { IRadarSeriesSpec } from './radar/interface';
import { AreaSeries, registerAreaSeries } from './area/area';
import type { IAreaSeriesSpec } from './area/interface';
import { DotSeries, registerDotSeries } from './dot/dot';
import type { IDotSeriesSpec } from './dot/interface';
import { LinkSeries, registerLinkSeries } from './link/link';
import type { ILinkSeriesSpec } from './link/interface';
import { CircularProgressSeries, registerCircularProgressSeries } from './progress/circular/circular';
import type { ICircularProgressSeriesSpec } from './progress/circular/interface';
import { LinearProgressSeries, registerLinearProgressSeries } from './progress/linear/linear';
import type { ILinearProgressSeriesSpec } from './progress/linear/interface';
import { WordCloudSeries, registerWordCloudSeries } from './word-cloud/word-cloud';
import type { IWordCloudSeriesBaseSpec, IWordCloudSeriesSpec } from './word-cloud/interface';
import { FunnelSeries, registerFunnelSeries } from './funnel/funnel';
import type { IFunnelSeriesSpec } from './funnel/interface';
import { SunburstSeries, registerSunBurstSeries } from './sunburst/sunburst';
import type { ISunburstSeriesSpec } from './sunburst/interface';
import { CirclePackingSeries, registerCirclePackingSeries } from './circle-packing/circle-packing';
import type { ICirclePackingSeriesSpec } from './circle-packing/interface';
import { SankeySeries, registerSankeySeries } from './sankey/sankey';
import type { ISankeySeriesSpec } from './sankey/interface';
import { TreemapSeries, registerTreemapSeries } from './treemap/treemap';
import type { ITreemapSeriesSpec } from './treemap/interface';
import type { IGaugePointerSeriesSpec, IGaugeSeriesSpec } from './gauge';
import { GaugePointerSeries, GaugeSeries, registerGaugePointerSeries, registerGaugeSeries } from './gauge';
import { HeatmapSeries, registerHeatmapSeries } from './heatmap/heatmap';
import type { IHeatmapSeriesSpec } from './heatmap/interface';
import { CorrelationSeries } from './correlation/correlation';
import type { ICorrelationSeriesSpec } from './correlation/interface';
import { BaseSeries } from './base/base-series';
import type { ICartesianSeriesSpec, ICartesianSeriesTheme } from './cartesian';
import { CartesianSeries } from './cartesian';
import { PolarSeries } from './polar/polar';
import type { IPolarSeriesSpec, IPolarSeriesTheme } from './polar/interface';
import type { IProgressLikeSeriesSpec } from './polar/progress-like';
import { ProgressLikeSeries } from './polar/progress-like';
import type { IRoseLikeSeriesSpec } from './polar/rose-like';
import { RoseLikeSeries } from './polar/rose-like';
import type { ILiquidSeriesSpec } from './liquid/interface';
import { LiquidSeries, registerLiquidSeries } from './liquid/liquid';
import type { IVennSeriesSpec } from './venn/interface';
import { VennSeries, registerVennSeries } from './venn/venn';
import type { IMosaicSeriesSpec } from './mosaic/interface';
import { MosaicSeries, registerMosaicSeries } from './mosaic/mosaic';

import type { ISeries, ICartesianSeries, IPolarSeries, IGeoSeries } from './interface';
import { barGrowIn, barGrowOut, barPresetAnimation, registerBarAnimation } from './bar/animation';
import { BaseWordCloudSeries } from './word-cloud/base';
import { RangeColumnSeriesSpecTransformer } from './range-column/range-column-transformer';
import { pieDisappear, pieEnter, pieExit, piePresetAnimation } from './pie/animation/animation';
import { PieSeriesSpecTransformer } from './pie/pie-transformer';
import { baseSeriesMark } from './base/constant';
import { FunnelSeriesSpecTransformer } from './funnel/funnel-transformer';
import { BaseSeriesTooltipHelper } from './base/tooltip-helper';
import { BaseSeriesSpecTransformer } from './base/base-series-transformer';
import { GeoSeries } from './geo/geo';

export {
  PositionEnum,
  barPresetAnimation,
  barGrowIn,
  barGrowOut,
  piePresetAnimation,
  pieEnter,
  pieExit,
  pieDisappear,
  baseSeriesMark
};

export {
  GeoSeries,
  BaseSeriesSpecTransformer,
  BaseSeriesTooltipHelper,
  WaterfallSeries,
  BarSeries,
  BarSeriesSpecTransformer,
  BoxPlotSeries,
  LineSeries,
  RadarSeries,
  RangeAreaSeries,
  RangeColumnSeriesSpecTransformer,
  RangeColumnSeries,
  MapSeries,
  PieSeriesSpecTransformer,
  BasePieSeries,
  PieSeries,
  SankeySeries,
  ScatterSeries,
  SunburstSeries,
  RoseLikeSeries,
  RoseSeries,
  AreaSeries,
  DotSeries,
  LinearProgressSeries,
  LinkSeries,
  CirclePackingSeries,
  CircularProgressSeries,
  BaseWordCloudSeries,
  WordCloudSeries,
  FunnelSeriesSpecTransformer,
  FunnelSeries,
  TreemapSeries,
  GaugePointerSeries,
  GaugeSeries,
  HeatmapSeries,
  BaseSeries,
  CartesianSeries,
  PolarSeries,
  ProgressLikeSeries,
  CorrelationSeries,
  LiquidSeries,
  VennSeries,
  MosaicSeries
};

export {
  registerAreaSeries,
  registerBarSeries,
  registerBarAnimation,
  registerBoxplotSeries,
  registerCirclePackingSeries,
  registerCircularProgressSeries,
  registerDotSeries,
  registerFunnelSeries,
  registerGaugePointerSeries,
  registerGaugeSeries,
  registerHeatmapSeries,
  registerLineSeries,
  registerLinearProgressSeries,
  registerLinkSeries,
  registerMapSeries,
  registerPieSeries,
  registerRadarSeries,
  registerRangeAreaSeries,
  registerRangeColumnSeries,
  registerRoseSeries,
  registerSankeySeries,
  registerScatterSeries,
  registerSunBurstSeries,
  registerTreemapSeries,
  registerWaterfallSeries,
  registerWordCloudSeries,
  registerLiquidSeries,
  registerVennSeries,
  registerMosaicSeries
};

export type {
  ICartesianSeriesTheme,
  IPolarSeriesTheme,
  IArcLabelSpec,
  IBarAnimationParams,
  BarAppearPreset,
  ISeries,
  ICartesianSeries,
  IPolarSeries,
  IGeoSeries,
  IRoseLikeSeriesSpec,
  IAreaSeriesSpec,
  IBarSeriesSpec,
  IBoxPlotSeriesSpec,
  ICartesianSeriesSpec,
  ICirclePackingSeriesSpec,
  ICircularProgressSeriesSpec,
  IDotSeriesSpec,
  IFunnelSeriesSpec,
  IGaugePointerSeriesSpec,
  IGaugeSeriesSpec,
  IHeatmapSeriesSpec,
  ILineSeriesSpec,
  ILinearProgressSeriesSpec,
  ILinkSeriesSpec,
  IMapSeriesSpec,
  IPieAnimationParams,
  PieAppearPreset,
  IPieSeriesSpec,
  IPolarSeriesSpec,
  IProgressLikeSeriesSpec,
  IRadarSeriesSpec,
  IRangeAreaSeriesSpec,
  IRangeColumnSeriesTheme,
  IRangeColumnSeriesSpec,
  IRoseSeriesSpec,
  ISankeySeriesSpec,
  IScatterSeriesSpec,
  ISunburstSeriesSpec,
  ITreemapSeriesSpec,
  IWaterfallSeriesSpec,
  IWordCloudSeriesBaseSpec,
  IWordCloudSeriesSpec,
  ICorrelationSeriesSpec,
  ILiquidSeriesSpec,
  IVennSeriesSpec,
  IMosaicSeriesSpec
};

export * from './interface';
export * from './util/utils';
