import React from 'react';
import type { IScatterChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerScatterChart, registerLabel } from '@visactor/vchart';
import { createChart } from './generate-charts';
import { registers } from './registers/cartesian';

export const ScatterChart = createChart<IScatterChartSpec>(
  'ScatterChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerScatterChart, registerLabel, ...registers]
);
