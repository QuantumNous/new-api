// /**
//  * @description 包含基础的折柱饼图，提供坐标轴、离散图例以及 tooltip、crosshair、label 组件
//  */
// import { VChart } from './core';
// import { registerHarmonyEnv } from './env';

// import { registerLineChart } from './chart/line';
// import { registerAreaChart } from './chart/area';
// import { registerBarChart } from './chart/bar';
// import { registerScatterChart } from './chart/scatter';
// import { registerPieChart } from './chart/pie';
// import { registerRoseChart } from './chart/rose';
// import { registerRadarChart } from './chart/radar';
// import { registerCommonChart } from './chart/common';
// import { registerHistogramChart } from './chart/histogram';
// import { registerCircularProgressChart } from './chart/progress/circular';
// import { registerGaugeChart } from './chart/gauge';
// import { registerWordCloudChart } from './chart/word-cloud';
// import { registerFunnelChart } from './chart/funnel';
// import { registerLinearProgressChart } from './chart/progress/linear';
// import { registerRangeColumnChart } from './chart/range-column';
// import { registerBoxplotChart } from './chart/box-plot';
// import {
//   registerCartesianBandAxis,
//   registerCartesianLinearAxis,
// } from './component/axis/cartesian';
// import { registerPolarBandAxis, registerPolarLinearAxis } from './component/axis/polar';
// import { registerContinuousLegend, registerDiscreteLegend } from './component/legend';
// import { registerTooltip } from './component/tooltip';
// import { registerCartesianCrossHair } from './component/crosshair';
// import { registerTitle } from './component/title';
// import { registerLabel } from './component/label';
// import { registerCustomMark } from './component/custom-mark';
// import { DefaultTicker } from '@visactor/vrender-core';
// import { registerAnimate } from './plugin/other';
// import { registerCirclePackingChart, registerMapChart, registerRangeAreaChart, registerSankeyChart, registerSunburstChart, registerTreemapChart, registerWaterfallChart } from './chart';

// VChart.useRegisters([
//   registerAnimate,
//   // charts
//   registerLineChart,
//   registerAreaChart,
//   registerBarChart,
//   registerScatterChart,
//   registerPieChart,
//   registerRoseChart,
//   registerRadarChart,
//   registerHistogramChart,
//   registerMapChart,
//   registerGaugeChart,
//   registerWordCloudChart,
//   registerFunnelChart,
//   registerWaterfallChart,
//   registerBoxplotChart,
//   registerCircularProgressChart,
//   registerLinearProgressChart,
//   registerRangeColumnChart,
//   registerRangeAreaChart,
//   registerSunburstChart,
//   registerCirclePackingChart,
//   registerTreemapChart,
//   registerSankeyChart,
//   // registerHeatmapChart,
//   // registerCorrelationChart,
//   // 优化vchart-all体积, 默认不注册
//   // registerLiquidChart,
//   // registerVennChart,
//   registerCommonChart,

//   // components
//   registerCartesianLinearAxis,
//   registerCartesianBandAxis,
//   // registerCartesianTimeAxis,
//   // registerCartesianLogAxis,
//   // registerCartesianSymlogAxis,
//   registerPolarBandAxis,
//   registerPolarLinearAxis,

//   registerDiscreteLegend,
//   registerContinuousLegend,

//   registerTooltip,
//   registerCartesianCrossHair,
//   // registerPolarCrossHair,

//   // registerDataZoom,
//   // registerScrollBar,
//   // registerIndicator,
//   // registerGeoCoordinate,

//   // registerMarkLine,
//   // registerMarkArea,
//   // registerMarkPoint,
//   // registerPolarMarkLine,
//   // registerPolarMarkArea,
//   // registerPolarMarkPoint,
//   // registerGeoMarkPoint,

//   registerTitle,
//   // registerPlayer,
//   registerLabel,
//   // registerTotalLabel,
//   // registerBrush,
//   registerCustomMark,
//   // registerMapLabel,
//   // registerPoptip,

//   // layout
//   // registerGridLayout,

//   // plugin
//   // registerCanvasTooltipHandler,

//   // interactions,
//   // registerElementHighlight,
//   // registerElementSelect
// ]);

// // load env code
// VChart.useRegisters([registerHarmonyEnv]);

// export { VChart, DefaultTicker };

// export default VChart;

// export * from './core';
// export * from './plugin/chart';
// export * from './plugin/components/tooltip-handler';
// export * from './plugin/components/axis-sync';
