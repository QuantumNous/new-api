import React from 'react';
import type { IWaterfallChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerWaterfallChart, registerLabel, registerTotalLabel } from '@visactor/vchart';
import { createChart } from './generate-charts';
import { registers } from './registers/cartesian';

export const WaterfallChart = createChart<IWaterfallChartSpec>(
  'WaterfallChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerWaterfallChart, registerLabel, registerTotalLabel, ...registers]
);
