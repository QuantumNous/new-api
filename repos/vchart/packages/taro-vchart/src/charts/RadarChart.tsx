import React from 'react';
import type { IRadarChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerRadarChart, registerLabel } from '@visactor/vchart';
import { createChart } from './generate-charts';
import { registers } from './registers/polar';

export const RadarChart = createChart<IRadarChartSpec>(
  'RadarChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerRadarChart, registerLabel, ...registers]
);
