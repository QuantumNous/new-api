import type { AdaptiveSpec } from '../../../typings';
import { BaseComponentSpecTransformer } from '../../base';
import type { IDataZoomSpec, IDataZoomTheme } from './interface';
export declare class DataZoomSpecTransformer<T extends IDataZoomSpec = IDataZoomSpec, K extends IDataZoomTheme = IDataZoomTheme> extends BaseComponentSpecTransformer<AdaptiveSpec<T, 'width' | 'height'>, K> {
    protected _mergeThemeToSpec(spec: AdaptiveSpec<T, 'width' | 'height'>, chartSpec: any): {
        spec: AdaptiveSpec<T, 'width' | 'height'>;
        theme: K;
    };
}
