import type { IVChartConstructor, ICircularProgressChartSpec } from '@visactor/vchart';
import { VChart, registerCircularProgressChart, registerLabel, registerIndicator } from '@visactor/vchart';
import { registers } from './registers/polar';
import { createChart } from './generate-charts';

export const CircularProgressChart = createChart<ICircularProgressChartSpec>(
  'CircularProgressChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerCircularProgressChart, registerLabel, registerIndicator, ...registers]
);
