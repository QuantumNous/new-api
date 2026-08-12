import type { IVChartConstructor, ICirclePackingChartSpec } from '@visactor/vchart';
import { VChart, registerCirclePackingChart } from '@visactor/vchart';
import { registers } from './registers/cartesian';
import { createChart } from './generate-charts';

export const CirclePackingChart = createChart<ICirclePackingChartSpec>(
  'CirclePackingChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerCirclePackingChart, ...registers]
);
