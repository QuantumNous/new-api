import type { IRoseChartSpec } from '../rose';
import { RadarChartSpecTransformer } from './radar-transformer';
import { BaseChart } from '../base';
export declare class RadarChart<T extends IRoseChartSpec = IRoseChartSpec> extends BaseChart<T> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof RadarChartSpecTransformer;
    readonly transformerConstructor: typeof RadarChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
    protected _setModelOption(): void;
}
export declare const registerRadarChart: () => void;
