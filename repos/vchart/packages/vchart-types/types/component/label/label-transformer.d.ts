import type { IChartSpec } from '../../typings';
import { BaseComponentSpecTransformer } from '../base';
export declare class LabelSpecTransformer<T extends IChartSpec = any, K = any> extends BaseComponentSpecTransformer<T, K> {
    protected _initTheme(spec: T, chartSpec: any): {
        spec: T;
        theme: K;
    };
}
