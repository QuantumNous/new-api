import { BaseChart } from '../base/base-chart';
import type { ISankeyChartSpec } from './interface';
import { SankeyChartSpecTransformer } from './sankey-transformer';
import type { Datum, MaybeArray } from '../../typings/common';
import type { ISeries } from '../../series/interface';
import type { IMark } from '../../mark/interface/common';
import type { IRegionQuerier } from '../../typings/params';
export declare class SankeyChart<T extends ISankeyChartSpec = ISankeyChartSpec> extends BaseChart<T> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof SankeyChartSpecTransformer;
    readonly transformerConstructor: typeof SankeyChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
    protected _setStateInDatum(stateKey: string, datum: MaybeArray<Datum> | null, filter?: (series: ISeries, mark: IMark) => boolean, region?: IRegionQuerier): void;
}
export declare const registerSankeyChart: () => void;
