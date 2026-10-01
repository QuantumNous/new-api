/**
 * @description 包含基础的折柱饼图，提供坐标轴、离散图例以及 tooltip、crosshair、label 组件
 */
import { VChart } from './core';
import { registerPieChart } from './chart/pie/pie';

import { registerLabel } from './component/label/label';
import { registerTooltip } from './component/tooltip/tooltip';
import { registerDiscreteLegend } from './component/legend/discrete/legend';
import { registerCanvasTooltipHandler, registerDomTooltipHandler } from './plugin/components';

export * from './core';

// VChart.useRegisters([
//   registerPieChart,

//   // components
//   registerDiscreteLegend,
//   registerTooltip,
//   registerLabel,

//   // plugin
//   registerDomTooltipHandler,
//   registerCanvasTooltipHandler
// ]);

export { VChart };

export default VChart;
