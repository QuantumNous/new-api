import type { ISeries } from '../../series/interface';
export interface ISeriesPlugin {
    afterSeriesDataInit?: (series: ISeries) => void;
    afterSeriesMarkInit?: (series: ISeries) => void;
}
export interface ISeriesPluginConstructor {
    readonly type: 'seriesPlugin';
    new (): ISeriesPlugin;
}
