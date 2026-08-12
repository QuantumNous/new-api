import React from 'react';
import type { ISunburstChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerSunburstChart } from '@visactor/vchart';
import { createChart } from './generate-charts';
import { registers } from './registers/simple';

export const SunburstChart = createChart<ISunburstChartSpec>(
  'SunburstChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerSunburstChart, ...registers]
);
