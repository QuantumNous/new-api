export type ILayoutNumber = number | IPercent | ((layoutRect: ILayoutRect) => number) | IPercentOffset;
export interface ILayoutPoint {
    x: number;
    y: number;
}
export interface ILayoutRect {
    width: number;
    height: number;
}
export type IPercent = `${number}%`;
export type IPercentOffset = {
    percent?: number;
    offset?: number;
};
export type ILayoutPercent = IPercent | number;
export type ILayoutType = 'region-relative' | 'region-relative-overlap' | 'region' | 'normal' | 'absolute' | 'normal-inline';
export type ILayoutOrientPadding = {
    left?: ILayoutNumber;
    right?: ILayoutNumber;
    top?: ILayoutNumber;
    bottom?: ILayoutNumber;
};
export type ILayoutPaddingSpec = ILayoutOrientPadding | ILayoutNumber | ILayoutNumber[];
export type ILayoutAlignSelf = 'start' | 'end' | 'middle';
