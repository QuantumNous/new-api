import type { IVChartConstructor, ILineChartSpec } from '@visactor/vchart';
import { VChart, registerLineChart, registerLabel, registerTotalLabel } from '@visactor/vchart';
import { registers } from './registers/cartesian';
import { createChart } from './generate-charts';

export const LineChart = createChart<ILineChartSpec>(
  'LineChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerLineChart, registerLabel, registerTotalLabel, ...registers]
);
