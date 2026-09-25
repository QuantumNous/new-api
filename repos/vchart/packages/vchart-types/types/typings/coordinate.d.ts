export type CoordinateType = 'cartesian' | 'polar' | 'geo' | 'none';
export interface IPoint {
    x: number;
    y: number;
}
export interface IPolarPoint {
    radius: number;
    angle: number;
}
