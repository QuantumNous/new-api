import type React from 'react';
import type { IVChartConstructor } from '@visactor/vchart';
import { VChart, registerIndicator, registerLabel } from '@visactor/vchart';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';
import { registers } from './registers/simple';
import { registerPie3dChart } from '@visactor/vchart-extension';
import type { IPie3dChartSpec } from '@visactor/vchart-extension';

export interface Pie3dChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<IPie3dChartSpec>, 'type'> {}

export const Pie3dChart = createChart<React.PropsWithChildren<Pie3dChartProps> & { type?: 'pie3d' }>(
  'Pie3dChart',
  {
    type: 'pie3d',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerPie3dChart, registerLabel, registerIndicator, ...registers]
);
