import type React from 'react';
import type { IScatterChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerScatterChart, registerLabel } from '@visactor/vchart';
import { registers } from './registers/cartesian';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';

export interface ScatterChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<IScatterChartSpec>, 'type'> {}

export const ScatterChart = createChart<React.PropsWithChildren<ScatterChartProps> & { type?: 'scatter' }>(
  'ScatterChart',
  {
    type: 'scatter',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerScatterChart, registerLabel, ...registers]
);
