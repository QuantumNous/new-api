export type CellSizeGetter = (params: { index: number }) => number;

export type CellSize = CellSizeGetter | number;

export type Alignment = 'auto' | 'end' | 'start' | 'center';

export type VisibleCellRange = {
    start?: number;
    stop?: number
};
