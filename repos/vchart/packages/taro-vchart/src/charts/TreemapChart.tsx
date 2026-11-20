import React from 'react';
import type { ITreemapChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerTreemapChart } from '@visactor/vchart';
import { createChart } from './generate-charts';
import { registers } from './registers/simple';

export const TreemapChart = createChart<ITreemapChartSpec>(
  'TreemapChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerTreemapChart, ...registers]
);
