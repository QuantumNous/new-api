import type React from 'react';
import type { IVChartConstructor } from '@visactor/vchart';
import { VChart, registerLabel, registerTotalLabel } from '@visactor/vchart';
import { registerBar3dChart } from '@visactor/vchart-extension';
import type { IBar3dChartSpec } from '@visactor/vchart-extension';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';
import { registers } from './registers/cartesian';

export interface Bar3dChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<IBar3dChartSpec>, 'type'> {
  //
}

export const Bar3dChart = createChart<React.PropsWithChildren<Bar3dChartProps> & { type?: 'bar3d' }>(
  'Bar3dChart',
  {
    type: 'bar3d',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerBar3dChart, registerLabel, registerTotalLabel, ...registers]
);
