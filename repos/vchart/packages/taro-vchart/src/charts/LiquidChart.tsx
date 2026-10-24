import React from 'react';
import type { IVChartConstructor, ILiquidChartSpec } from '@visactor/vchart';
import { VChart, registerLiquidChart, registerIndicator } from '@visactor/vchart';
import { createChart } from './generate-charts';
import { registers } from './registers/simple';

export const LiquidChart = createChart<ILiquidChartSpec>(
  'LiquidChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [registerLiquidChart, registerIndicator, ...registers]
);
