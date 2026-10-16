import type React from 'react';
import type { IRangeAreaChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerRangeAreaChart, registerLabel } from '@visactor/vchart';
import { registers } from './registers/cartesian';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';

export interface RangeAreaChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<IRangeAreaChartSpec>, 'type'> {}

export const RangeAreaChart = createChart<React.PropsWithChildren<RangeAreaChartProps> & { type?: 'rangeArea' }>(
  'RangeAreaChart',
  {
    type: 'rangeArea',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerRangeAreaChart, registerLabel, ...registers]
);
