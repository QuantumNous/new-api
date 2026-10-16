import type { IVChartConstructor } from '@visactor/vchart';
import { VChart, registerTotalLabel, registerLabel } from '@visactor/vchart';
import { registers } from './registers/cartesian';
import { createChart } from './generate-charts';
import { registerBar3dChart } from '@visactor/vchart-extension';
import type { IBar3dChartSpec } from '@visactor/vchart-extension';

export const Bar3dChart = createChart<IBar3dChartSpec>(
  'Bar3dChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerBar3dChart, registerLabel, registerTotalLabel, ...registers]
);
