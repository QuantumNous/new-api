import type { IVChartConstructor, IAreaChartSpec } from '@visactor/vchart';
import { VChart, registerAreaChart, registerLabel } from '@visactor/vchart';
import { registers } from './registers/cartesian';
import { createChart } from './generate-charts';

export const AreaChart = createChart<IAreaChartSpec>(
  'AreaChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerAreaChart, registerLabel, ...registers]
);
