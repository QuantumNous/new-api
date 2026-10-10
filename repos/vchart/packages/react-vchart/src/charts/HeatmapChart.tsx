import type React from 'react';
import type { IHeatmapChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerHeatmapChart, registerLabel } from '@visactor/vchart';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';
import { registers } from './registers/cartesian';

export interface HeatmapChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<IHeatmapChartSpec>, 'type'> {
  //
}

export const HeatmapChart = createChart<React.PropsWithChildren<HeatmapChartProps> & { type?: 'heatmap' }>(
  'HeatmapChart',
  {
    type: 'heatmap',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerHeatmapChart, registerLabel, ...registers]
);
