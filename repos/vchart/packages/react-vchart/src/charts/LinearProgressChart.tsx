import type React from 'react';
import type { ILinearProgressChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerLinearProgressChart, registerLabel } from '@visactor/vchart';
import { registers } from './registers/cartesian';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';

export interface LinearProgressChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<ILinearProgressChartSpec>, 'type'> {}

export const LinearProgressChart = createChart<
  React.PropsWithChildren<LinearProgressChartProps> & { type?: 'linearProgress' }
>(
  'LinearProgressChart',
  {
    type: 'linearProgress',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerLinearProgressChart, registerLabel, ...registers]
);
