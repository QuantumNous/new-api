import React from 'react';
import type { IVChartConstructor, IMapChartSpec } from '@visactor/vchart';
import { VChart, registerMapChart, registerLabel } from '@visactor/vchart';
import { createChart } from './generate-charts';
import { registers } from './registers/simple';

export const MapChart = createChart<IMapChartSpec>(
  'MapChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerMapChart, registerLabel, ...registers]
);
