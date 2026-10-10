import { BaseChart } from '../base/base-chart';
import type { ISequenceChartSpec } from './interface';
import type { ISeriesConstructor } from '../../series/interface';
import type { IModelSpecInfo } from '../../model/interface';
import { SequenceChartSpecTransformer } from './sequence-transformer';
export declare class SequenceChart<T extends ISequenceChartSpec = ISequenceChartSpec> extends BaseChart<T> {
    static readonly type: string;
    static readonly transformerConstructor: typeof SequenceChartSpecTransformer;
    readonly transformerConstructor: typeof SequenceChartSpecTransformer;
    readonly type: string;
    protected _createSeries(constructor: ISeriesConstructor, specInfo: IModelSpecInfo): void;
}
export declare const registerSequenceChart: () => void;
