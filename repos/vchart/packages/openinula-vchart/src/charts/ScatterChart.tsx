import React from 'openinula';
import type { IScatterChartSpec } from '@visactor/vchart';
import { default as VChart } from '@visactor/vchart';
import { BaseChartProps, createChart } from './BaseChart';

export interface ScatterChartProps
  extends Omit<BaseChartProps, 'spec' | 'container' | 'type'>,
    Omit<IScatterChartSpec, 'type'> {}

export const ScatterChart = createChart<React.PropsWithChildren<ScatterChartProps> & { type: 'scatter' }>(
  'ScatterChart',
  {
    type: 'scatter',
    vchartConstructor: VChart
  }
);
