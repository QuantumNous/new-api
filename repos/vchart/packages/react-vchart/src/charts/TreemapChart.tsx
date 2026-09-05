import type React from 'react';
import type { ITreemapChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerLabel, registerTreemapChart } from '@visactor/vchart';
import { registers } from './registers/simple';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';

export interface TreemapChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<ITreemapChartSpec>, 'type'> {}

export const TreemapChart = createChart<React.PropsWithChildren<TreemapChartProps> & { type?: 'treemap' }>(
  'TreemapChart',
  {
    type: 'treemap',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerTreemapChart, registerLabel, ...registers]
);
