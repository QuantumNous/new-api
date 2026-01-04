//reference from https://github.com/bvaughn/react-virtualized
import { CellSizeAndPositionManager } from './CellSizeAndPositionManager';
import { CellSizeGetter, Alignment, VisibleCellRange } from './types';

type Params = {
    maxScrollSize?: number;
    cellCount: number;
    cellSizeGetter: CellSizeGetter;
    estimatedCellSize: number
};

type ContainerSizeAndOffset = {
    containerSize: number;
    offset: number
};

const DEFAULT_MAX_ELEMENT_SIZE = 1500000;
const CHROME_MAX_ELEMENT_SIZE = 1.67771e7;

const isBrowser = () => typeof window !== 'undefined';
// @ts-ignore
const isChrome = () => !!window.chrome;

export const getMaxElementSize = (): number => {
    if (isBrowser()) {
        if (isChrome()) {
            return CHROME_MAX_ELEMENT_SIZE;
        }
    }
    return DEFAULT_MAX_ELEMENT_SIZE;
};

export class ScalingCellSizeAndPositionManager {
    private _maxScrollSize: number;
    private _cellSizeAndPositionManager: CellSizeAndPositionManager;

    constructor({ maxScrollSize = getMaxElementSize(), cellCount, cellSizeGetter, estimatedCellSize }: Params) {
        this._maxScrollSize = maxScrollSize;
        this._cellSizeAndPositionManager = new CellSizeAndPositionManager({
            cellCount,
            cellSizeGetter,
            estimatedCellSize,
        });
    }

    areOffsetsAdjusted() {
        return this._cellSizeAndPositionManager.getTotalSize() > this._maxScrollSize;
    }

    configure(params: { cellCount: number; estimatedCellSize: number; cellSizeGetter: CellSizeGetter }) {
        this._cellSizeAndPositionManager.configure(params);
    }

    getCellCount(): number {
        return this._cellSizeAndPositionManager.getCellCount();
    }

    getEstimatedCellSize(): number {
        return this._cellSizeAndPositionManager.getEstimatedCellSize();
    }

    getLastMeasuredIndex(): number {
        return this._cellSizeAndPositionManager.getLastMeasuredIndex();
    }

    getOffsetAdjustment({ containerSize, offset }: ContainerSizeAndOffset) {
        const totalSize = this._cellSizeAndPositionManager.getTotalSize();

        const safeTotalSize = this.getTotalSize();

        const offsetPercentage = this._getOffsetPercentage({
            containerSize,
            offset,
            totalSize: safeTotalSize,
        });
        return Math.round(offsetPercentage * (safeTotalSize - totalSize));
    }

    getTotalSize(): number {
        return Math.min(this._maxScrollSize, this._cellSizeAndPositionManager.getTotalSize());
    }
    getSizeAndPositionOfCell(index: number) {
        return this._cellSizeAndPositionManager.getSizeAndPositionOfCell(index);
    }

    getSizeAndPositionOfLastMeasuredCell() {
        return this._cellSizeAndPositionManager.getSizeAndPositionOfLastMeasuredCell();
    }

    getVisibleCellRange({
        containerSize,
        offset, // safe
    }: ContainerSizeAndOffset): VisibleCellRange {
        offset = this._safeOffsetToOffset({
            containerSize,
            offset,
        });

        return this._cellSizeAndPositionManager.getVisibleCellRange({
            containerSize,
            offset,
        });
    }

    resetCell(index: number): void {
        this._cellSizeAndPositionManager.resetCell(index);
    }

    getUpdatedOffsetForIndex({
        align = 'auto',
        containerSize,
        currentOffset, // safe
        targetIndex,
    }: {
        align: Alignment;
        containerSize: number;
        currentOffset: number;
        targetIndex: number
    }) {
        currentOffset = this._safeOffsetToOffset({
            containerSize,
            offset: currentOffset,
        });

        const offset = this._cellSizeAndPositionManager.getUpdatedOffsetForIndex({
            align,
            containerSize,
            currentOffset,
            targetIndex,
        });

        return this._offsetToSafeOffset({
            containerSize,
            offset,
        });
    }

    private _getOffsetPercentage({
        containerSize,
        offset, // safe
        totalSize,
    }: {
        containerSize: number;
        offset: number;
        totalSize: number
    }) {
        return totalSize <= containerSize ? 0 : offset / (totalSize - containerSize);
    }

    private _offsetToSafeOffset({
        containerSize,
        offset, // unsafe
    }: ContainerSizeAndOffset): number {
        const totalSize = this._cellSizeAndPositionManager.getTotalSize();
        const safeTotalSize = this.getTotalSize();

        if (totalSize === safeTotalSize) {
            return offset;
        } else {
            const offsetPercentage = this._getOffsetPercentage({
                containerSize,
                offset,
                totalSize,
            });

            return Math.round(offsetPercentage * (safeTotalSize - containerSize));
        }
    }

    private _safeOffsetToOffset({
        containerSize,
        offset, // safe
    }: ContainerSizeAndOffset): number {
        const totalSize = this._cellSizeAndPositionManager.getTotalSize();
        const safeTotalSize = this.getTotalSize();

        if (totalSize === safeTotalSize) {
            return offset;
        } else {
            const offsetPercentage = this._getOffsetPercentage({
                containerSize,
                offset,
                totalSize: safeTotalSize,
            });

            return Math.round(offsetPercentage * (totalSize - containerSize));
        }
    }
}
