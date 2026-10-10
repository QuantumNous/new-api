import React from 'openinula';
import type { IPieChartSpec } from '@visactor/vchart';
import { default as VChart } from '@visactor/vchart';
import { BaseChartProps, createChart } from './BaseChart';

export interface PieChartProps
  extends Omit<BaseChartProps, 'spec' | 'container' | 'type'>,
    Omit<IPieChartSpec, 'type'> {}

export const PieChart = createChart<React.PropsWithChildren<PieChartProps> & { type: 'pie' }>('PieChart', {
  type: 'pie',
  vchartConstructor: VChart
});
