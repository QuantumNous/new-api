import type React from 'react';
import type { IVChartConstructor } from '@visactor/vchart';
import { VChart, registerLabel } from '@visactor/vchart';
import type { IPictogramChartSpec } from '@visactor/vchart-extension';
import { registerPictogramChart } from '@visactor/vchart-extension';
import { registers } from './registers/simple';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';

export interface PictogramChartProps
  extends Omit<BaseChartProps, 'container' | 'type' | 'data'>,
    Omit<Partial<IPictogramChartSpec>, 'type'> {}

export const PictogramChart = createChart<React.PropsWithChildren<PictogramChartProps> & { type?: 'pictogram' }>(
  'PictogramChart',
  {
    type: 'pictogram',
    vchartConstructor: VChart as IVChartConstructor
  },
  [registerPictogramChart, registerLabel, ...registers]
);
