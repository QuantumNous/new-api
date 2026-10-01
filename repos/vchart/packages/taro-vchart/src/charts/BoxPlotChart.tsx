import type { IVChartConstructor, IBoxPlotChartSpec } from '@visactor/vchart';
import { VChart, registerBoxplotChart, registerLabel } from '@visactor/vchart';
import { registers } from './registers/cartesian';
import { createChart } from './generate-charts';

export const BoxPlotChart = createChart<IBoxPlotChartSpec>(
  'BoxPlotChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerBoxplotChart, registerLabel, ...registers]
);
