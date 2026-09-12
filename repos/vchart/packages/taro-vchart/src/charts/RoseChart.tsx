import React from 'react';
import type { IRoseChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerRoseChart, registerLabel } from '@visactor/vchart';
import { createChart } from './generate-charts';
import { registers } from './registers/polar';

export const RoseChart = createChart<IRoseChartSpec>(
  'RoseChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerRoseChart, registerLabel, ...registers]
);
