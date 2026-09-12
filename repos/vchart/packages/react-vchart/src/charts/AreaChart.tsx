import type React from 'react';
import type { IAreaChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerAreaChart, registerLabel, registerTotalLabel } from '@visactor/vchart';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';
import { registers } from './registers/cartesian';

export interface AreaChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<IAreaChartSpec>, 'type'> {}

export const AreaChart = createChart<React.PropsWithChildren<AreaChartProps> & { type?: 'area' }>(
  'AreaChart',
  {
    type: 'area',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerAreaChart, registerLabel, registerTotalLabel, ...registers]
);
