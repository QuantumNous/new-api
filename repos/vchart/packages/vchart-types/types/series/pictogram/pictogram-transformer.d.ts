import type { ISeriesSpec } from '../../typings';
import { BaseSeriesSpecTransformer } from '../base';
export declare class PictogramSeriesSpecTransformer<T extends ISeriesSpec, K> extends BaseSeriesSpecTransformer<T, K> {
    protected _getDefaultSpecFromChart(chartSpec: any): any;
}
