import type React from 'react';
import type { ILiquidChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerLiquidChart, registerIndicator } from '@visactor/vchart';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';
import { registers } from './registers/simple';

export interface LiquidChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<ILiquidChartSpec>, 'type'> {}

export const LiquidChart = createChart<React.PropsWithChildren<LiquidChartProps> & { type?: 'liquid' }>(
  'LiquidChart',
  {
    type: 'liquid',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerLiquidChart, registerIndicator, ...registers]
);
