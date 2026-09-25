import React from 'openinula';
import { IBoxPlotChartSpec } from '@visactor/vchart';
import { default as VChart } from '@visactor/vchart';
import { BaseChartProps, createChart } from './BaseChart';

export interface BoxPlotChartProps
  extends Omit<BaseChartProps, 'spec' | 'container' | 'type'>,
    Omit<IBoxPlotChartSpec, 'type'> {}

export const BoxPlotChart = createChart<React.PropsWithChildren<BoxPlotChartProps> & { type: 'boxPlot' }>(
  'BoxPlotChart',
  {
    type: 'boxPlot',
    vchartConstructor: VChart
  }
);
