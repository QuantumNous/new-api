import type React from 'react';
import type { IRadarChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerRadarChart, registerLabel } from '@visactor/vchart';
import { registers } from './registers/polar';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';

export interface RadarChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<IRadarChartSpec>, 'type'> {}

export const RadarChart = createChart<React.PropsWithChildren<RadarChartProps> & { type?: 'radar' }>(
  'RadarChart',
  {
    type: 'radar',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerRadarChart, registerLabel, ...registers]
);
