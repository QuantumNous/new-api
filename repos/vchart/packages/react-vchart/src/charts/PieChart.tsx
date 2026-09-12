import type React from 'react';
import type { IPieChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerPieChart, registerLabel, registerIndicator } from '@visactor/vchart';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';
import { registers } from './registers/simple';

export interface PieChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<IPieChartSpec>, 'type'> {}

export const PieChart = createChart<React.PropsWithChildren<PieChartProps> & { type?: 'pie' }>(
  'PieChart',
  {
    type: 'pie',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerPieChart, registerLabel, registerIndicator, ...registers]
);
