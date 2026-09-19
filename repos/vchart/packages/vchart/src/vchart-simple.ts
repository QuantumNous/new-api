/**
 * @description 包含基础的折柱饼图，提供坐标轴、离散图例以及 tooltip、crosshair、label 组件
 */
import { VChart as BaseVChart } from './core';
import type { IInitOption, ISpec } from './typings';
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
import { registerCanvasTooltipHandler, registerDomTooltipHandler } from './plugin/components/tooltip-handler';
import { registerAnimate, registerHtmlAttributePlugin, registerReactAttributePlugin } from './plugin/other';

export * from './core';

class VChart extends BaseVChart {
  constructor(spec: ISpec, options: IInitOption) {
    super(spec, {
      poptip: false,
      ...options
    });
  }
}

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
  registerDomTooltipHandler,
  registerCanvasTooltipHandler,
  registerAnimate,
  registerReactAttributePlugin,
  registerHtmlAttributePlugin
]);

export { VChart };

export default VChart;
