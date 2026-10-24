import type { BaseSeries } from '../../series/base/base-series';
import type { TreemapSeries } from '../../series/treemap/treemap';
import type { AddVChartPropertyContext } from './add-property';
import type { SunburstSeries } from '../../series/sunburst/sunburst';
import type { CirclePackingSeries } from '../../series/circle-packing/circle-packing';
export declare function initKeyMap(this: BaseSeries<any>): {
    keyMap: Map<any, any>;
    needDefaultSeriesField: boolean;
    defaultSeriesField: string;
    getKey: (datum: import("../..").Datum, index: number, context: AddVChartPropertyContext) => unknown;
};
export declare function addDataKey(d: any, i: number, context: AddVChartPropertyContext): void;
export declare function initHierarchyKeyMap(this: TreemapSeries | SunburstSeries | CirclePackingSeries): {
    keyMap: Map<any, any>;
    needDefaultSeriesField: boolean;
    defaultSeriesField: string;
    getKey: any;
    categoryField: string;
};
export declare function addHierarchyDataKey(d: any, i: number, context: AddVChartPropertyContext, depth?: number, root?: string, rootIndex?: number): void;
