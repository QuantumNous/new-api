import type React from 'react';
import type { IWaterfallChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerWaterfallChart, registerLabel, registerTotalLabel } from '@visactor/vchart';
import { registers } from './registers/cartesian';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';

export interface WaterfallChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<IWaterfallChartSpec>, 'type'> {
  //
}

export const WaterfallChart = createChart<React.PropsWithChildren<WaterfallChartProps> & { type?: 'waterfall' }>(
  'WaterfallChart',
  {
    type: 'waterfall',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerWaterfallChart, registerLabel, registerTotalLabel, ...registers]
);
