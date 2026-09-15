import type React from 'react';
import type { ICircularProgressChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerCircularProgressChart, registerLabel, registerIndicator } from '@visactor/vchart';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';
import { registers } from './registers/polar';

export interface CircularProgressChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<ICircularProgressChartSpec>, 'type'> {}

export const CircularProgressChart = createChart<
  React.PropsWithChildren<CircularProgressChartProps> & { type?: 'circularProgress' }
>(
  'CircularProgressChart',
  {
    type: 'circularProgress',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerCircularProgressChart, registerLabel, registerIndicator, ...registers]
);
