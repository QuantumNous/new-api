import React from 'react';
import type { IVennChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerVennChart } from '@visactor/vchart';
import { createChart } from './generate-charts';
import { registers } from './registers/simple';

export const VennChart = createChart<IVennChartSpec>(
  'VennChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerVennChart, ...registers]
);
