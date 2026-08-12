import type React from 'react';
import type { IVChartConstructor } from '@visactor/vchart';
import { VChart, registerLabel } from '@visactor/vchart';
import { registers } from './registers/cartesian';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';
import { registerRangeColumn3dChart } from '@visactor/vchart-extension';
import type { IRangeColumn3dChartSpec } from '@visactor/vchart-extension';

export interface RangeColumn3dChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<IRangeColumn3dChartSpec>, 'type'> {}

export const RangeColumn3dChart = createChart<
  React.PropsWithChildren<RangeColumn3dChartProps> & { type?: 'rangeColumn3d' }
>(
  'RangeColumn3dChart',
  {
    type: 'rangeColumn3d',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerRangeColumn3dChart, registerLabel, ...registers]
);
