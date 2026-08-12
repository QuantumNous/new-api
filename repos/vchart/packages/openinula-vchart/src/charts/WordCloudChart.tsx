import React from 'openinula';
import type { IWordCloudChartSpec } from '@visactor/vchart';
import { default as VChart } from '@visactor/vchart';
import { BaseChartProps, createChart } from './BaseChart';

export interface WordCloudChartProps
  extends Omit<BaseChartProps, 'spec' | 'container' | 'type'>,
    Omit<IWordCloudChartSpec, 'type'> {}

export const WordCloudChart = createChart<React.PropsWithChildren<WordCloudChartProps> & { type: 'wordCloud' }>(
  'WordCloudChart',
  {
    type: 'wordCloud',
    vchartConstructor: VChart
  }
);
