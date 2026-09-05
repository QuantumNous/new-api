import React from 'openinula';
import { IHistogramChartSpec } from '@visactor/vchart';
import { default as VChart } from '@visactor/vchart';
import { BaseChartProps, createChart } from './BaseChart';

export interface HistogramChartProps
  extends Omit<BaseChartProps, 'spec' | 'container' | 'type'>,
    Omit<IHistogramChartSpec, 'type'> {}

export const HistogramChart = createChart<React.PropsWithChildren<HistogramChartProps> & { type: 'histogram' }>(
  'HistogramChart',
  {
    type: 'histogram',
    vchartConstructor: VChart
  }
);
