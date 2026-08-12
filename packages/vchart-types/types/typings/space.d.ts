export interface IRect {
    x: number;
    y: number;
    width: number;
    height: number;
}
export type IOrientType = 'left' | 'top' | 'right' | 'bottom' | 'z';
export type IPolarOrientType = 'radius' | 'angle';
export interface IPadding {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
}
export declare const enum Direction {
    vertical = "vertical",
    horizontal = "horizontal"
}
export type DirectionType = keyof typeof Direction;
