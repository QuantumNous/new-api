import { registerAllEnv } from './../../../../vchart/src/env/env';
import { VChart } from '@visactor/vchart/esm/core';

import { registerLineChart } from '@visactor/vchart/esm/chart/line';
import { registerAreaChart } from '@visactor/vchart/esm/chart/area';
import { registerBarChart } from '@visactor/vchart/esm/chart/bar';
import { registerScatterChart } from '@visactor/vchart/esm/chart/scatter';
import { registerPieChart } from '@visactor/vchart/esm/chart/pie';
import { registerRoseChart } from '@visactor/vchart/esm/chart/rose';
import { registerRadarChart } from '@visactor/vchart/esm/chart/radar';
import {
  registerCartesianBandAxis,
  registerCartesianLinearAxis,
  registerCartesianLogAxis,
  registerCartesianSymlogAxis,
  registerCartesianTimeAxis
} from '@visactor/vchart/esm/component/axis/cartesian';
import { registerPolarBandAxis, registerPolarLinearAxis } from '@visactor/vchart/esm/component/axis/polar';
import { registerContinuousLegend, registerDiscreteLegend } from '@visactor/vchart/esm/component/legend';
import { registerTooltip } from '@visactor/vchart/esm/component/tooltip';
import { registerCartesianCrossHair, registerPolarCrossHair } from '@visactor/vchart/esm/component/crosshair';
import { registerDataZoom } from '@visactor/vchart/esm/component/data-zoom';
import { registerIndicator } from '@visactor/vchart/esm/component/indicator';
import { registerMarkLine } from '@visactor/vchart/esm/component/marker/mark-line';
import { registerMarkPoint } from '@visactor/vchart/esm/component/marker/mark-point';

import { registerTitle } from '@visactor/vchart/esm/component/title';
import { registerMarkArea } from '@visactor/vchart/esm/component/marker/mark-area';
import { registerLabel } from '@visactor/vchart/esm/component/label';
import { registerCanvasTooltipHandler } from '@visactor/vchart/esm/plugin/components/tooltip-handler';
import { registerFunnelChart } from '@visactor/vchart/esm/chart/funnel';
import { registerWordCloudChart } from '@visactor/vchart/esm/chart/word-cloud';
import { registerBoxplotChart } from '@visactor/vchart/esm/chart/box-plot';
import { registerCommonChart } from '@visactor/vchart/esm/chart/common';
import { registerSankeyChart } from '@visactor/vchart/esm/chart/sankey';

export function initVChart() {
  VChart.useRegisters([
    // charts
    registerLineChart,
    registerAreaChart,
    registerBarChart,
    registerScatterChart,
    registerPieChart,
    registerRoseChart,
    registerRadarChart,
    registerFunnelChart,
    registerWordCloudChart,
    registerBoxplotChart,
    registerSankeyChart,
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
    registerIndicator,
    registerMarkPoint,
    registerMarkLine,
    registerMarkArea,
    registerTitle,
    registerLabel,

    // plugin
    registerCanvasTooltipHandler,
    registerAllEnv
  ]);
}
export { VChart };
