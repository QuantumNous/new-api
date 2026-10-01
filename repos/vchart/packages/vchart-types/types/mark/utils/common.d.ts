import { MarkTypeEnum } from '../interface/type';
import type { Datum } from '../../typings';
import type { GroupedData } from '../interface/common';
export declare const MultiDatumMark: string[];
export declare function isMultiDatumMark(type: MarkTypeEnum): boolean;
export declare function curveTypeTransform(type: string, direction: string): string;
export declare function groupData<T>(data: T[], groupBy: (datum: Datum, index: number) => string, sort?: (a: T, b: T) => number): GroupedData<T>;
export declare const runEncoder: (styles: Record<string, (datum: Datum) => any>, datum: Datum, attrs?: any) => any;
