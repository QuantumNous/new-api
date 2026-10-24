/**
 * @description 包含基础的折柱饼图，提供坐标轴、离散图例以及 tooltip、crosshair、label 组件
 */
import { VChart } from './core';
import { registerWXEnv } from './env';

import { registerLineChart } from './chart/line';
import { registerAreaChart } from './chart/area';
import { registerBarChart } from './chart/bar';
import { registerScatterChart } from './chart/scatter';
import { registerMapChart } from './chart/map';
import { registerPieChart } from './chart/pie';
import { registerRoseChart } from './chart/rose';
import { registerRadarChart } from './chart/radar';
import { registerCommonChart } from './chart/common';
import { registerHistogramChart } from './chart/histogram';
import { registerCircularProgressChart } from './chart/progress/circular';
import { registerGaugeChart } from './chart/gauge';
import { registerWordCloudChart } from './chart/word-cloud';
import { registerFunnelChart } from './chart/funnel';
import { registerLinearProgressChart } from './chart/progress/linear';
import { registerRangeColumnChart } from './chart/range-column';
import { registerSunburstChart } from './chart/sunburst';
import { registerCirclePackingChart } from './chart/circle-packing';
import { registerTreemapChart } from './chart/treemap';
import { registerWaterfallChart } from './chart/waterfall';
import { registerBoxplotChart } from './chart/box-plot';
import { registerSankeyChart } from './chart/sankey';
import { registerRangeAreaChart } from './chart/range-area';
import { registerHeatmapChart } from './chart/heatmap';
import { registerCorrelationChart } from './chart/correlation';
import {
  registerCartesianBandAxis,
  registerCartesianLinearAxis,
  registerCartesianLogAxis,
  registerCartesianSymlogAxis,
  registerCartesianTimeAxis
} from './component/axis/cartesian';
import { registerPolarBandAxis, registerPolarLinearAxis } from './component/axis/polar';
import { registerContinuousLegend, registerDiscreteLegend } from './component/legend';
import { registerTooltip } from './component/tooltip';
import { registerCartesianCrossHair, registerPolarCrossHair } from './component/crosshair';
import { registerDataZoom, registerScrollBar } from './component/data-zoom';
import { registerIndicator } from './component/indicator';
import { registerGeoCoordinate } from './component/geo';
import { registerMarkLine, registerPolarMarkLine } from './component/marker/mark-line';
import { registerTitle } from './component/title';
import { registerMarkArea, registerPolarMarkArea } from './component/marker/mark-area';
import { registerPlayer } from './component/player';
import { registerLabel } from './component/label';
import { registerTotalLabel } from './component/label/total-label';
import { registerMarkPoint, registerPolarMarkPoint, registerGeoMarkPoint } from './component/marker/mark-point';
import { registerBrush } from './component/brush';
import { registerCustomMark } from './component/custom-mark';
import { registerGridLayout } from './layout/grid-layout/grid-layout';
import { registerPoptip } from './component/poptip';
import { registerCanvasTooltipHandler } from './plugin/components/tooltip-handler';
import { registerElementHighlight } from './interaction/triggers/element-highlight';
import { registerElementSelect } from './interaction/triggers/element-select';

VChart.useRegisters([
  // charts
  registerLineChart,
  registerAreaChart,
  registerBarChart,
  registerScatterChart,
  registerPieChart,
  registerRoseChart,
  registerRadarChart,
  registerHistogramChart,
  registerMapChart,
  registerGaugeChart,
  registerWordCloudChart,
  registerFunnelChart,
  registerWaterfallChart,
  registerBoxplotChart,
  registerCircularProgressChart,
  registerLinearProgressChart,
  registerRangeColumnChart,
  registerRangeAreaChart,
  registerSunburstChart,
  registerCirclePackingChart,
  registerTreemapChart,
  registerSankeyChart,
  registerHeatmapChart,
  registerCorrelationChart,
  // 优化vchart-all体积, 默认不注册
  // registerLiquidChart,
  // registerVennChart,
  registerCommonChart,

  // components
  registerCartesianLinearAxis,
  registerCartesianBandAxis,
  registerCartesianTimeAxis,
  registerCartesianLogAxis,
  registerCartesianSymlogAxis,
  registerPolarBandAxis,
  registerPolarLinearAxis,

  registerDiscreteLegend,
  registerContinuousLegend,

  registerTooltip,
  registerCartesianCrossHair,
  registerPolarCrossHair,

  registerDataZoom,
  registerScrollBar,
  registerIndicator,
  registerGeoCoordinate,

  registerMarkLine,
  registerMarkArea,
  registerMarkPoint,
  registerPolarMarkLine,
  registerPolarMarkArea,
  registerPolarMarkPoint,
  registerGeoMarkPoint,

  registerTitle,
  registerPlayer,
  registerLabel,
  registerTotalLabel,
  registerBrush,
  registerCustomMark,
  registerPoptip,

  // layout
  registerGridLayout,

  // plugin
  registerCanvasTooltipHandler,

  // interactions,
  registerElementHighlight,
  registerElementSelect
]);

// load env code
VChart.useRegisters([registerWXEnv]);

export { VChart };

export default VChart;

export * from './core';
export * from './plugin/chart';
export * from './plugin/components/tooltip-handler';
export * from './plugin/components/axis-sync';
