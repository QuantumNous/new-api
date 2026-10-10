import type React from 'react';
import type { ISankeyChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerLabel, registerSankeyChart } from '@visactor/vchart';
import { registers } from './registers/simple';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';

export interface SankeyChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<ISankeyChartSpec>, 'type'> {}

export const SankeyChart = createChart<React.PropsWithChildren<SankeyChartProps> & { type?: 'sankey' }>(
  'SankeyChart',
  {
    type: 'sankey',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerSankeyChart, registerLabel, ...registers]
);
