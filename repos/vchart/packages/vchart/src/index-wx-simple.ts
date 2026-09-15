/**
 * @description 包含基础的折柱饼图，提供坐标轴、离散图例以及 tooltip、crosshair、label 组件
 */
import { VChart } from './core';
import { registerLineChart } from './chart/line/line';
import { registerBarChart } from './chart/bar/bar';
import { registerAreaChart } from './chart/area/area';
import { registerPieChart } from './chart/pie/pie';
import { registerCommonChart } from './chart/common/common';

import { registerLabel } from './component/label/label';
import { registerCartesianCrossHair } from './component/crosshair/cartesian';
import { registerTooltip } from './component/tooltip/tooltip';
import { registerDiscreteLegend } from './component/legend/discrete/legend';
import { registerCartesianBandAxis } from './component/axis/cartesian/band-axis';
import { registerCartesianLinearAxis } from './component/axis/cartesian/linear-axis';
import { registerWXEnv } from './env';
import { registerCanvasTooltipHandler } from './plugin/components/tooltip-handler';
import { registerFormatPlugin } from './plugin/chart/formatter';
import { registerElementHighlight } from './interaction/triggers/element-highlight';
import { registerElementSelect } from './interaction/triggers/element-select';

export * from './core';

VChart.useRegisters([
  // charts
  registerLineChart,
  registerAreaChart,
  registerBarChart,
  registerPieChart,
  registerCommonChart,

  // components
  registerCartesianLinearAxis,
  registerCartesianBandAxis,
  registerDiscreteLegend,
  registerTooltip,
  registerCartesianCrossHair,
  registerLabel,

  // plugin
  registerCanvasTooltipHandler,
  registerFormatPlugin,

  // interactions,
  registerElementHighlight,
  registerElementSelect
]);

VChart.useRegisters([registerWXEnv]);

export { VChart };

export default VChart;
