import React from 'react';
import type { ISequenceChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerSequenceChart } from '@visactor/vchart';
import { createChart } from './generate-charts';
import { registers } from './registers/cartesian';

export const SequenceChart = createChart<ISequenceChartSpec>(
  'SequenceChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerSequenceChart, ...registers]
);
