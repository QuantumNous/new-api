import React from 'react';
import type { IVChartConstructor } from '@visactor/vchart';
import { VChart, registerLabel, registerIndicator } from '@visactor/vchart';
import { registerPie3dChart, IPie3dChartSpec } from '@visactor/vchart-extension';
import { createChart } from './generate-charts';
import { registers } from './registers/simple';

export const Pie3dChart = createChart<IPie3dChartSpec>(
  'Pie3dChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerPie3dChart, registerLabel, registerIndicator, ...registers]
);
