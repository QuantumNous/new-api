import { BaseSeriesSpecTransformer } from '../base';
import type { IBasePieSeriesSpec, IPieSeriesTheme } from './interface';
export declare class PieSeriesSpecTransformer<T extends IBasePieSeriesSpec = IBasePieSeriesSpec, K extends IPieSeriesTheme = IPieSeriesTheme> extends BaseSeriesSpecTransformer<T, K> {
    protected _transformLabelSpec(spec: T): void;
    protected _mergeThemeToSpec(spec: T, chartSpec: any): {
        spec: T;
        theme: K;
    };
    protected _getDefaultSpecFromChart(chartSpec: any): any;
}
