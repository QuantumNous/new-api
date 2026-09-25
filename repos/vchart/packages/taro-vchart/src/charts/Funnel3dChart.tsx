import { IVChartConstructor } from '@visactor/vchart';
import { VChart, registerLabel } from '@visactor/vchart';
import { createChart } from './generate-charts';
import { registers } from './registers/simple';
import { registerFunnel3dChart } from '@visactor/vchart-extension';
import type { IFunnel3dChartSpec } from '@visactor/vchart-extension';

export const Funnel3dChart = createChart<IFunnel3dChartSpec>(
  'Funnel3dChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerFunnel3dChart, registerLabel, ...registers]
);
