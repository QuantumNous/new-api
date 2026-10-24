import type React from 'react';
import type { IVennChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerLabel, registerVennChart } from '@visactor/vchart';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';
import { registers } from './registers/simple';

export interface VennChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<IVennChartSpec, 'type'> {}

export const VennChart = createChart<React.PropsWithChildren<VennChartProps> & { type: 'venn' }>(
  'VennChart',
  {
    type: 'venn',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerVennChart, registerLabel, ...registers]
);
