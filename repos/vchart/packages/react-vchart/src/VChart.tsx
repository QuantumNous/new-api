import { BaseChartProps, createChart } from './charts/BaseChart';
import { default as VChartCore } from '@visactor/vchart';
export type VChartProps = Omit<BaseChartProps, 'container' | 'width' | 'height' | 'type'>;

export const VChart = createChart<VChartProps>('VChart', {
  vchartConstructor: VChartCore
});
