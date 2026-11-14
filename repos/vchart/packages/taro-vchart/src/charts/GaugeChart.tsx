import React from 'react';
import type { IGaugeChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerGaugeChart } from '@visactor/vchart';
import { createChart } from './generate-charts';
import { registers } from './registers/simple';

export const GaugeChart = createChart<IGaugeChartSpec>(
  'GaugeChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerGaugeChart, ...registers]
);
