import { BarSeriesSpecTransformer } from '../bar/bar-transformer';
import type { IWaterfallSeriesSpec, IWaterfallSeriesTheme } from './interface';
export declare class WaterfallSeriesSpecTransformer<T extends IWaterfallSeriesSpec = IWaterfallSeriesSpec, K extends IWaterfallSeriesTheme = IWaterfallSeriesTheme> extends BarSeriesSpecTransformer<any, K> {
    protected _supportStack: boolean;
    protected _transformLabelSpec(spec: T): void;
}
