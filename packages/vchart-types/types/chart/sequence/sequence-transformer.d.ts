import { BaseChartSpecTransformer } from '../base';
import type { ISequenceChartSpec } from './interface';
import type { RegionSpec } from '../../typings';
export declare class SequenceChartSpecTransformer<T extends ISequenceChartSpec = ISequenceChartSpec> extends BaseChartSpecTransformer<T> {
    private _getSeriesDataLength;
    addAttrToComponentSpec(componentSpec: any, attr: string, value: any): any;
    addPaddingRow(rowHeight: any[], rowNum: number, size: number): void;
    addOrientAxes(region: RegionSpec[], elements: any[], rowNum: number, spec: T): void;
    transformSpec(spec: T): void;
}
