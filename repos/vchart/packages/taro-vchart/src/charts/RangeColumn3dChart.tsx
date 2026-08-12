import React from 'react';
import type { IVChartConstructor } from '@visactor/vchart';
import { VChart, registerLabel } from '@visactor/vchart';
import { createChart } from './generate-charts';
import { registers } from './registers/cartesian';
import { registerRangeColumn3dChart } from '@visactor/vchart-extension';
import type { IRangeColumn3dChartSpec } from '@visactor/vchart-extension';

export const RangeColumn3dChart = createChart<IRangeColumn3dChartSpec>(
  'RangeColumn3dChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerRangeColumn3dChart, registerLabel, ...registers]
);
