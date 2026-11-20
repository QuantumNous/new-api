import React from 'react';
import type { IVChartConstructor } from '@visactor/vchart';
import { VChart } from '@visactor/vchart';
import { createChart } from './generate-charts';
import { registers } from './registers/simple';
import { registerWordCloud3dChart } from '@visactor/vchart-extension';
import type { IWordCloud3dChartSpec } from '@visactor/vchart-extension';

export const WordCloud3dChart = createChart<IWordCloud3dChartSpec>(
  'WordCloud3dChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerWordCloud3dChart, ...registers]
);
