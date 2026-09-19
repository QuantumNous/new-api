import type React from 'react';
import type { ILineChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerLineChart, registerLabel } from '@visactor/vchart';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';
import { registers } from './registers/cartesian';

export interface LineChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<ILineChartSpec>, 'type'> {}

export const LineChart = createChart<React.PropsWithChildren<LineChartProps> & { type?: 'line' }>(
  'LineChart',
  {
    type: 'line',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerLineChart, registerLabel, ...registers]
);
