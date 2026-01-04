//reference from https://github.com/bvaughn/react-virtualized
import { Alignment, CellSizeGetter, VisibleCellRange } from './types';

type CellSizeAndPositionManagerParams = {
    cellCount: number;
    cellSizeGetter: CellSizeGetter;
    estimatedCellSize: number
};

type GetUpdatedOffsetForIndex = {
    align: Alignment;
    containerSize: number;
    currentOffset: number;
    targetIndex: number
};

type SizeAndPositionData = {
    offset: number;
    size: number
};

type GetVisibleCellRangeParams = {
    containerSize: number;
    offset: number
};

export class CellSizeAndPositionManager {
    private _cellCount: number;
    private _cellSizeGetter: CellSizeGetter;
    private _estimatedCellSize: number;

    private _lastMeasuredIndex = -1;
    private _cellSizeAndPositionData: Record<number, SizeAndPositionData> = {};
    private _lastBatchedIndex = -1;

    constructor(params: CellSizeAndPositionManagerParams) {
        this._cellCount = params.cellCount;
        this._cellSizeGetter = params.cellSizeGetter;
        this._estimatedCellSize = params.estimatedCellSize;
    }

    areOffsetsAdjusted() {
        return false;
    }

    configure(params: CellSizeAndPositionManagerParams) {
        this._cellCount = params.cellCount;
        this._cellSizeGetter = params.cellSizeGetter;
        this._estimatedCellSize = params.estimatedCellSize;
    }

    getCellCount() {
        return this._cellCount;
    }

    getEstimatedCellSize() {
        return this._estimatedCellSize;
    }

    getLastMeasuredIndex() {
        return this._lastMeasuredIndex;
    }

    getOffsetAdjustment() {
        return 0;
    }

    getSizeAndPositionOfCell(index: number): SizeAndPositionData {
        if (index < 0 || index >= this._cellCount) {
            throw new Error('index out of bounds');
        }

        if (index > this._lastMeasuredIndex) {
            const lastMeasuredCellSizeAndPosition = this.getSizeAndPositionOfLastMeasuredCell();
            let offset = lastMeasuredCellSizeAndPosition.offset + lastMeasuredCellSizeAndPosition.size;
            for (let i = this._lastMeasuredIndex + 1; i <= index; i++) {
                const size = this._cellSizeGetter({ index: i });
                if (size === undefined || isNaN(size)) {
                    throw new Error('invalid size');
                } else if (size === null) {
                    this._cellSizeAndPositionData[i] = {
                        offset,
                        size: 0,
                    };
                    this._lastBatchedIndex = index;
                } else {
                    this._cellSizeAndPositionData[i] = {
                        offset,
                        size,
                    };
                    offset += size;
                    this._lastMeasuredIndex = index;
                }
            }
        }
        return this._cellSizeAndPositionData[index];
    }

    getSizeAndPositionOfLastMeasuredCell(): SizeAndPositionData {
        return this._lastMeasuredIndex >= 0
            ? this._cellSizeAndPositionData[this._lastMeasuredIndex]
            : { offset: 0, size: 0 };
    }

    getTotalSize(): number {
        const lastMeasuredCellSizeAndPosition = this.getSizeAndPositionOfLastMeasuredCell();
        const totalSizeOfMeasuredCells = lastMeasuredCellSizeAndPosition.offset + lastMeasuredCellSizeAndPosition.size;
        const numUnmeasuredCells = this._cellCount - this._lastMeasuredIndex - 1;
        const totalSizeOfUnmeasuredCells = numUnmeasuredCells * this._estimatedCellSize;
        return totalSizeOfMeasuredCells + totalSizeOfUnmeasuredCells;
    }

    getUpdatedOffsetForIndex({ align, containerSize, currentOffset, targetIndex }: GetUpdatedOffsetForIndex) {
        if (currentOffset < 0) {
            return 0;
        }
        const datum = this.getSizeAndPositionOfCell(targetIndex);
        const maxOffset = datum.offset;
        const minOffset = maxOffset - containerSize + datum.size;
        let idealOffset = currentOffset;
        switch (align) {
            case 'start':
                idealOffset = maxOffset;
                break;
            case 'end':
                idealOffset = minOffset;
                break;
            case 'center':
                idealOffset = maxOffset - (containerSize - datum.size) / 2;
                break;
            default:
                idealOffset = Math.max(minOffset, Math.min(maxOffset, currentOffset));
                break;
        }
        const totalSize = this.getTotalSize();
        return Math.max(0, Math.min(idealOffset, totalSize - containerSize));
    }

    getVisibleCellRange(params: GetVisibleCellRangeParams): VisibleCellRange {
        const containerSize = params.containerSize;
        let offset = params.offset;
        const totalSize = this.getTotalSize();
        if (totalSize === 0) {
            return {};
        }
        const maxOffset = offset + containerSize;
        const start = this._findNearestCell(offset);
        const datum = this.getSizeAndPositionOfCell(start);

        offset = datum.offset + datum.size;

        let stop = start;
        while (offset < maxOffset && stop < this._cellCount - 1) {
            stop++;
            offset += this.getSizeAndPositionOfCell(stop).size;
        }
        return {
            start,
            stop,
        };
    }

    private _binarySearch(high: number, low: number, offset: number): number {
        while (low <= high) {
            const middle = low + Math.floor((high - low) / 2);
            const currentOffset = this.getSizeAndPositionOfCell(middle).offset;

            if (currentOffset === offset) {
                return middle;
            } else if (currentOffset < offset) {
                low = middle + 1;
            } else if (currentOffset > offset) {
                high = middle - 1;
            }
        }

        if (low > 0) {
            return low - 1;
        } else {
            return 0;
        }
    }

    resetCell(index: number): void {
        this._lastMeasuredIndex = Math.min(this._lastMeasuredIndex, index - 1);
    }

    private _exponentialSearch(index: number, offset: number): number {
        let interval = 1;

        while (index < this._cellCount && this.getSizeAndPositionOfCell(index).offset < offset) {
            index += interval;
            interval *= 2;
        }

        return this._binarySearch(Math.min(index, this._cellCount - 1), Math.floor(index / 2), offset);
    }

    private _findNearestCell(offset: number) {
        if (isNaN(offset)) {
            throw new Error('offset is NaN');
        }
        offset = Math.max(0, offset);
        const lastMeasuredCellSizeAndPosition = this.getSizeAndPositionOfLastMeasuredCell();
        const lastMeasuredIndex = Math.max(0, this._lastMeasuredIndex);

        if (lastMeasuredCellSizeAndPosition.offset >= offset) {
            return this._binarySearch(lastMeasuredIndex, 0, offset);
        } else {
            return this._exponentialSearch(lastMeasuredIndex, offset);
        }
    }
}
