import type React from 'react';
import type { IRoseChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerRoseChart, registerLabel } from '@visactor/vchart';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';
import { registers } from './registers/polar';

export interface RoseChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<IRoseChartSpec>, 'type'> {}

export const RoseChart = createChart<React.PropsWithChildren<RoseChartProps> & { type?: 'rose' }>(
  'RoseChart',
  {
    type: 'rose',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerRoseChart, registerLabel, ...registers]
);
