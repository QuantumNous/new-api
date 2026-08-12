import type React from 'react';
import type { IBarChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerBarChart, registerLabel, registerTotalLabel } from '@visactor/vchart';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';
import { registers } from './registers/cartesian';

export interface BarChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<IBarChartSpec>, 'type'> {
  //
}

export const BarChart = createChart<React.PropsWithChildren<BarChartProps> & { type?: 'bar' }>(
  'BarChart',
  {
    type: 'bar',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerBarChart, registerLabel, registerTotalLabel, ...registers]
);
