import type React from 'react';
import type { IGaugeChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerGaugeChart } from '@visactor/vchart';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';
import { registers } from './registers/simple';

export interface GaugeChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<IGaugeChartSpec>, 'type'> {}

export const GaugeChart = createChart<React.PropsWithChildren<GaugeChartProps> & { type?: 'gauge' }>(
  'GaugeChart',
  {
    type: 'gauge',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerGaugeChart, ...registers]
);
