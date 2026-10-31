import React from 'openinula';
import type { IRangeColumnChartSpec } from '@visactor/vchart';
import { default as VChart } from '@visactor/vchart';
import { BaseChartProps, createChart } from './BaseChart';

export interface RangeColumnChartProps
  extends Omit<BaseChartProps, 'spec' | 'container' | 'type'>,
    Omit<IRangeColumnChartSpec, 'type'> {}

export const RangeColumnChart = createChart<React.PropsWithChildren<RangeColumnChartProps> & { type: 'rangeColumn' }>(
  'RangeColumnChart',
  {
    type: 'rangeColumn',
    vchartConstructor: VChart
  }
);
