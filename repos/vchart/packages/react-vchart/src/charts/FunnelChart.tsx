import type React from 'react';
import type { IFunnelChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerFunnelChart, registerLabel } from '@visactor/vchart';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';
import { registers } from './registers/simple';

export interface FunnelChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<IFunnelChartSpec>, 'type'> {}

export const FunnelChart = createChart<React.PropsWithChildren<FunnelChartProps> & { type?: 'funnel' }>(
  'FunnelChart',
  {
    type: 'funnel',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerFunnelChart, registerLabel, ...registers]
);
