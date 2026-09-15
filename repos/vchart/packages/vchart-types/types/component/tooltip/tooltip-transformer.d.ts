import type { IChartSpecInfo } from '../../chart/interface';
import { BaseComponentSpecTransformer } from '../base';
export declare class TooltipSpecTransformer extends BaseComponentSpecTransformer<any> {
    protected _shouldMergeThemeToSpec(): boolean;
    protected _initTheme(spec: any, chartSpec: any): {
        spec: any;
        theme: any;
    };
    protected _transformSpecAfterMergingTheme(spec: any, chartSpec: any, chartSpecInfo?: IChartSpecInfo): void;
}
