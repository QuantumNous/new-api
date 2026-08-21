import type React from 'react';
import type { IVChartConstructor } from '@visactor/vchart';
import { VChart, registerLabel } from '@visactor/vchart';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';
import { registers } from './registers/cartesian';
import type { IHistogram3dChartSpec } from '@visactor/vchart-extension';
import { registerHistogram3dChart } from '@visactor/vchart-extension';

export interface Histogram3dChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<IHistogram3dChartSpec>, 'type'> {}

export const Histogram3dChart = createChart<React.PropsWithChildren<Histogram3dChartProps> & { type?: 'histogram3d' }>(
  'Histogram3dChart',
  {
    type: 'histogram3d',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerHistogram3dChart, registerLabel, ...registers]
);
