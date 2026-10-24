import { BaseModelSpecTransformer } from '../model/base-model-transformer';
import type { IRegionSpec } from './interface';
export declare class RegionSpecTransformer<T extends IRegionSpec = IRegionSpec, K extends Partial<IRegionSpec> = Partial<IRegionSpec>> extends BaseModelSpecTransformer<T, K> {
    protected _initTheme(spec: T, chartSpec: any): {
        spec: T;
        theme: K;
    };
}
