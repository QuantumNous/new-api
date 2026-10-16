import type { IPoint } from '../../../typings';
export declare function getInsertPoints(start: IPoint, end: IPoint, direction: 'top' | 'bottom' | 'left' | 'right', offset?: number): IPoint[];
export declare function getTextOffset(start: IPoint, end: IPoint, direction: 'top' | 'bottom' | 'left' | 'right', offset?: number): {
    dx: number;
    dy: number;
} | {
    dx?: undefined;
    dy?: undefined;
};
