import type { Feature } from '@visactor/vutils';
import type { IRect, IOrientType, IPoint } from '../../typings';
type IBound = {
    x1: number;
    x2: number;
    y1: number;
    y2: number;
};
export interface IPairInfo {
    rect: IRect;
    point: IPoint;
    pointCoord?: IPoint;
    anchors?: IOrientType[];
    offset?: number;
    index: number;
}
export declare function bound(rect: IRect): IBound;
export declare function layoutByPosition(pairs: IPairInfo[]): IRect[];
export declare function layoutOuter(pairs: IPairInfo[], features: Feature[], dataToPosition: (coord: number[]) => IPoint | null): IRect[];
export declare function layoutOuter2(pairs: IPairInfo[], features: Feature[], dataToPosition: (coord: number[]) => IPoint | null): IRect[];
export declare function placeRectByOrient(rect: IRect, position: IOrientType, offset?: number): IRect;
export declare function candidatesByOrient(positions: IOrientType[], anchor: IPoint, rect: Pick<IRect, 'width' | 'height'>, offset?: number): IPoint[];
export {};
