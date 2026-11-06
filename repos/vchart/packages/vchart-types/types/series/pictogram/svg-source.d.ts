import { DataView } from '@visactor/vdataset';
import type { ISVGSourceOption } from '@visactor/vdataset';
export declare const svgSourceMap: Map<string, DataView>;
export declare function registerSVGSource(key: string, source: ISVGSourceOption): void;
export declare function unregisterSVGSource(key: string): void;
export declare function getSVGSource(type: string): DataView;
export declare function clearSVGSource(): void;
