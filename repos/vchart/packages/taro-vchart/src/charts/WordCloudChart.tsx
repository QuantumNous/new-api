import React from 'react';
import type { IWordCloudChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerWordCloudChart } from '@visactor/vchart';
import { createChart } from './generate-charts';
import { registers } from './registers/simple';

export const WordCloudChart = createChart<IWordCloudChartSpec>(
  'WordCloudChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerWordCloudChart, ...registers]
);
