import React from 'react';
import { IFunnelChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerFunnelChart, registerLabel } from '@visactor/vchart';
import { createChart } from './generate-charts';
import { registers } from './registers/simple';

export const FunnelChart = createChart<IFunnelChartSpec>(
  'FunnelChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerFunnelChart, registerLabel, ...registers]
);
