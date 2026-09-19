import React from 'react';
import type { ISankeyChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerSankeyChart } from '@visactor/vchart';
import { createChart } from './generate-charts';
import { registers } from './registers/simple';

export const SankeyChart = createChart<ISankeyChartSpec>(
  'SankeyChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerSankeyChart, ...registers]
);
