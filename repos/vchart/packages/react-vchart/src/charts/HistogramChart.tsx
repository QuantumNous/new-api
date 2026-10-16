import type React from 'react';
import type { IHistogramChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerHistogramChart, registerLabel } from '@visactor/vchart';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';
import { registers } from './registers/cartesian';

export interface HistogramChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<IHistogramChartSpec>, 'type'> {}

export const HistogramChart = createChart<React.PropsWithChildren<HistogramChartProps> & { type?: 'histogram' }>(
  'HistogramChart',
  {
    type: 'histogram',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerHistogramChart, registerLabel, ...registers]
);
