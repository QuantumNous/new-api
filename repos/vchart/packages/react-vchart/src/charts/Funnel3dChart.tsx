import type React from 'react';
import type { IVChartConstructor } from '@visactor/vchart';
import { VChart, registerLabel } from '@visactor/vchart';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';
import { registers } from './registers/simple';
import type { IFunnel3dChartSpec } from '@visactor/vchart-extension';
import { registerFunnel3dChart } from '@visactor/vchart-extension';

export interface Funnel3dChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<IFunnel3dChartSpec>, 'type'> {}

export const Funnel3dChart = createChart<React.PropsWithChildren<Funnel3dChartProps> & { type?: 'funnel3d' }>(
  'Funnel3dChart',
  {
    type: 'funnel3d',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerFunnel3dChart, registerLabel, ...registers]
);
