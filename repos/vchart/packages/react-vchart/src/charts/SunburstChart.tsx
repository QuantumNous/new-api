import type React from 'react';
import type { ISunburstChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerLabel, registerSunburstChart } from '@visactor/vchart';
import { registers } from './registers/simple';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';

export interface SunburstChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<ISunburstChartSpec>, 'type'> {}

export const SunburstChart = createChart<React.PropsWithChildren<SunburstChartProps> & { type?: 'sunburst' }>(
  'SunburstChart',
  {
    type: 'sunburst',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerSunburstChart, registerLabel, ...registers]
);
