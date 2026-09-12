import { type SankeyOptions, type SankeyData } from '@visactor/vlayouts';
export interface ISankeyOpt extends SankeyOptions {
    targetField: string;
    sourceField: string;
    valueField: string;
    view: () => {
        x0: number;
        x1: number;
        y0: number;
        y1: number;
    };
}
type SankeyLayoutOption = ISankeyOpt | (() => ISankeyOpt);
type SankeyFormatDatum = Record<string, unknown> & {
    id?: 'links' | 'nodes';
    values?: unknown;
    latestData?: SankeyData[];
    children?: SankeyFormatDatum[];
};
export declare const collectHierarchyField: <T>(set: Set<T>, data: SankeyFormatDatum[], field: string) => void;
export declare const sankeyFormat: (data: SankeyFormatDatum[]) => SankeyData[];
export declare const sankeyLayout: (data: SankeyData[], op: SankeyLayoutOption) => {
    nodes: import("@visactor/vlayouts").SankeyNodeElement[];
    links: import("@visactor/vlayouts").SankeyLinkElement[];
    columns: import("@visactor/vlayouts").SankeyNodeElement[][];
}[];
export {};
