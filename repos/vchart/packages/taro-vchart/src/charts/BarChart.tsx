import type { IVChartConstructor, IBarChartSpec } from '@visactor/vchart';
import { VChart, registerBarChart, registerTotalLabel, registerLabel } from '@visactor/vchart';
import { registers } from './registers/cartesian';
import { createChart } from './generate-charts';

export const BarChart = createChart<IBarChartSpec>(
  'BarChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerBarChart, registerLabel, registerTotalLabel, ...registers]
);
