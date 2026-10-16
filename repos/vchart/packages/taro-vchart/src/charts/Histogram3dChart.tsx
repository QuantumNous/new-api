import React from 'react';
import { IVChartConstructor } from '@visactor/vchart';
import { VChart, registerLabel } from '@visactor/vchart';
import { createChart } from './generate-charts';
import { registers } from './registers/cartesian';
import { registerHistogram3dChart } from '@visactor/vchart-extension';
import type { IHistogram3dChartSpec } from '@visactor/vchart-extension';

export const Histogram3dChart = createChart<IHistogram3dChartSpec>(
  'Histogram3dChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerHistogram3dChart, registerLabel, ...registers]
);
