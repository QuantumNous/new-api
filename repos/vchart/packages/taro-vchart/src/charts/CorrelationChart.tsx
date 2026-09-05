import type { IVChartConstructor, ICorrelationChartSpec } from '@visactor/vchart';
import { VChart, registerCorrelationChart } from '@visactor/vchart';
import { registers } from './registers/cartesian';
import { createChart } from './generate-charts';

export const CorrelationChart = createChart<ICorrelationChartSpec>(
  'CorrelationChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerCorrelationChart, ...registers]
);
