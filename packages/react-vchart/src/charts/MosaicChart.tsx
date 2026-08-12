import type React from 'react';
import type { IMosaicChartSpec, IVChartConstructor } from '@visactor/vchart';
import { VChart, registerMosaicChart, registerLabel, registerTotalLabel } from '@visactor/vchart';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';
import { registers } from './registers/cartesian';

export interface MosaicChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<IMosaicChartSpec>, 'type'> {
  //
}

export const MosaicChart = createChart<React.PropsWithChildren<MosaicChartProps> & { type?: 'mosaic' }>(
  'MosaicChart',
  {
    type: 'mosaic',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerMosaicChart, registerLabel, registerTotalLabel, ...registers]
);
