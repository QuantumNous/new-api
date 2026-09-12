import type React from 'react';
import type { ICorrelationChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerCorrelationChart } from '@visactor/vchart';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';
import { registers } from './registers/simple';

export interface CorrelationChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<ICorrelationChartSpec>, 'type'> {}

export const CorrelationChart = createChart<React.PropsWithChildren<CorrelationChartProps> & { type?: 'correlation' }>(
  'CorrelationChart',
  {
    type: 'correlation',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerCorrelationChart, ...registers]
);
