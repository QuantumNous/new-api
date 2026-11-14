import * as VChart from '@visactor/vchart';
import * as VChartExtension '@visactor/vchart-extension';


VChart.Tooltip.builtInTheme.tooltip.transitionDuration = 0;

(window as any).VChart = VChart;
(window as any).VChartExtension = VChartExtension;

export default {
  VChart, VChartExtension
};

