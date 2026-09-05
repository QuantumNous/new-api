import { BaseModelSpecTransformer } from '../../model';
import type { IComponentSpec } from './interface';
export declare class BaseComponentSpecTransformer<T extends IComponentSpec = IComponentSpec, K = any> extends BaseModelSpecTransformer<T, K> {
    getTheme(spec: T, chartSpec: any): K;
    protected _mergeThemeToSpec(spec: T, chartSpec: any): {
        spec: T;
        theme: K;
    };
    protected _adjustPadding(spec: T): void;
}
