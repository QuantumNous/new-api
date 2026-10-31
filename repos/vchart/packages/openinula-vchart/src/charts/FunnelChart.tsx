import React from 'openinula';
import { IFunnelChartSpec } from '@visactor/vchart';
import { default as VChart } from '@visactor/vchart';
import { BaseChartProps, createChart } from './BaseChart';

export interface FunnelChartProps
  extends Omit<BaseChartProps, 'spec' | 'container' | 'type'>,
    Omit<IFunnelChartSpec, 'type'> {}

export const FunnelChart = createChart<React.PropsWithChildren<FunnelChartProps> & { type: 'funnel' }>('FunnelChart', {
  type: 'funnel',
  vchartConstructor: VChart
});
