import type { IIndicatorItemSpec } from './interface';
export interface IIndicatorDatum {
    type: 'title' | 'content';
    index: number;
    datum: unknown;
    spec: IIndicatorItemSpec;
}
export interface IIndicatorMapper {
    title: IIndicatorItemSpec;
    content: IIndicatorItemSpec[];
    datum: () => unknown;
}
export type IndicatorMapperOption = IIndicatorMapper | (() => IIndicatorMapper);
export declare const indicatorMapper: (data: Array<unknown>, op: IndicatorMapperOption) => IIndicatorDatum[];
