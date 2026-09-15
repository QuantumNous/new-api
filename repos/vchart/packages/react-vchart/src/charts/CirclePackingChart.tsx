import type React from 'react';
import type { ICirclePackingChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerCirclePackingChart, registerLabel } from '@visactor/vchart';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';
import { registers } from './registers/simple';

export interface CirclePackingChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<ICirclePackingChartSpec>, 'type'> {}

export const CirclePackingChart = createChart<
  React.PropsWithChildren<CirclePackingChartProps> & { type?: 'circlePacking' }
>(
  'CirclePackingChart',
  {
    type: 'circlePacking',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerCirclePackingChart, registerLabel, ...registers]
);
