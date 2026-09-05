import type { IVChartConstructor } from '@visactor/vchart';
import { BaseChartProps, createChart } from './charts/BaseChart';

export type VChartSimpleProps = Omit<BaseChartProps, 'container' | 'data' | 'width' | 'height' | 'vchartConstructor'>;

export const VChartSimple = createChart<VChartSimpleProps & { vchartConstructor: IVChartConstructor }>('VChartSimple');
