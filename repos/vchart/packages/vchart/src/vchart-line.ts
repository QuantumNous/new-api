/**
 * @description 单线图分析入口，提供基础坐标轴、离散图例、tooltip、crosshair、label 和动画能力
 */
import { VChart } from './core';
import { registerLineChart } from './chart/line/line';

import { registerLabel } from './component/label/label';
import { registerCartesianCrossHair } from './component/crosshair/cartesian';
import { registerTooltip } from './component/tooltip/tooltip';
import { registerDiscreteLegend } from './component/legend/discrete/legend';
import { registerCartesianBandAxis } from './component/axis/cartesian/band-axis';
import { registerCartesianLinearAxis } from './component/axis/cartesian/linear-axis';
import { registerCanvasTooltipHandler, registerDomTooltipHandler } from './plugin/components/tooltip-handler';
import { registerAnimate, registerHtmlAttributePlugin, registerReactAttributePlugin } from './plugin/other';

export * from './core';

VChart.useRegisters([
  registerLineChart,
  registerCartesianLinearAxis,
  registerCartesianBandAxis,
  registerDiscreteLegend,
  registerTooltip,
  registerCartesianCrossHair,
  registerLabel,
  registerDomTooltipHandler,
  registerCanvasTooltipHandler,
  registerAnimate,
  registerReactAttributePlugin,
  registerHtmlAttributePlugin
]);

export { VChart };

export default VChart;
