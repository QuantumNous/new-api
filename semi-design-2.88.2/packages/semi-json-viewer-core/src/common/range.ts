/** based on https://github.com/microsoft/vscode with modifications for custom requirements */

import { IPosition, Position } from './position';

/**
 * A range in the editor. This interface is suitable for serialization.
 */
export interface IRange {
    /**
     * Line number on which the range starts (starts at 1).
     */
    readonly startLineNumber: number;
    /**
     * Column on which the range starts in line `startLineNumber` (starts at 1).
     */
    readonly startColumn: number;
    /**
     * Line number on which the range ends.
     */
    readonly endLineNumber: number;
    /**
     * Column on which the range ends in line `endLineNumber`.
     */
    readonly endColumn: number
}

/**
 * A range in the editor. (startLineNumber,startColumn) is <= (endLineNumber,endColumn)
 */
export class Range {
    /**
     * Line number on which the range starts (starts at 1).
     */
    public readonly startLineNumber: number;
    /**
     * Column on which the range starts in line `startLineNumber` (starts at 1).
     */
    public readonly startColumn: number;
    /**
     * Line number on which the range ends.
     */
    public readonly endLineNumber: number;
    /**
     * Column on which the range ends in line `endLineNumber`.
     */
    public readonly endColumn: number;

    constructor(startLineNumber: number, startColumn: number, endLineNumber: number, endColumn: number) {
        if (startLineNumber > endLineNumber || (startLineNumber === endLineNumber && startColumn > endColumn)) {
            this.startLineNumber = endLineNumber;
            this.startColumn = endColumn;
            this.endLineNumber = startLineNumber;
            this.endColumn = startColumn;
        } else {
            this.startLineNumber = startLineNumber;
            this.startColumn = startColumn;
            this.endLineNumber = endLineNumber;
            this.endColumn = endColumn;
        }
    }

    static create(start: IPosition, end: IPosition): Range {
        return new Range(start.lineNumber, start.column, end.lineNumber, end.column);
    }

    /**
     * Test if the two ranges are intersecting. If the ranges are touching it returns true.
     */
    public static areIntersecting(a: IRange, b: IRange): boolean {
        // Check if `a` is before `b`
        if (
            a.endLineNumber < b.startLineNumber ||
            (a.endLineNumber === b.startLineNumber && a.endColumn <= b.startColumn)
        ) {
            return false;
        }

        // Check if `b` is before `a`
        if (
            b.endLineNumber < a.startLineNumber ||
            (b.endLineNumber === a.startLineNumber && b.endColumn <= a.startColumn)
        ) {
            return false;
        }

        // These ranges must intersect
        return true;
    }

    /**
     * A reunion of the two ranges.
     * The smallest position will be used as the start point, and the largest one as the end point.
     */
    public plusRange(range: IRange): Range {
        return Range.plusRange(this, range);
    }

    /**
     * A reunion of the two ranges.
     * The smallest position will be used as the start point, and the largest one as the end point.
     */
    public static plusRange(a: IRange, b: IRange): Range {
        let startLineNumber: number;
        let startColumn: number;
        let endLineNumber: number;
        let endColumn: number;

        if (b.startLineNumber < a.startLineNumber) {
            startLineNumber = b.startLineNumber;
            startColumn = b.startColumn;
        } else if (b.startLineNumber === a.startLineNumber) {
            startLineNumber = b.startLineNumber;
            startColumn = Math.min(b.startColumn, a.startColumn);
        } else {
            startLineNumber = a.startLineNumber;
            startColumn = a.startColumn;
        }

        if (b.endLineNumber > a.endLineNumber) {
            endLineNumber = b.endLineNumber;
            endColumn = b.endColumn;
        } else if (b.endLineNumber === a.endLineNumber) {
            endLineNumber = b.endLineNumber;
            endColumn = Math.max(b.endColumn, a.endColumn);
        } else {
            endLineNumber = a.endLineNumber;
            endColumn = a.endColumn;
        }

        return new Range(startLineNumber, startColumn, endLineNumber, endColumn);
    }

    /**
     * Return the start position (which will be before or equal to the end position)
     */
    public getStartPosition(): Position {
        return Range.getStartPosition(this);
    }

    /**
     * Return the start position (which will be before or equal to the end position)
     */
    public static getStartPosition(range: IRange): Position {
        return new Position(range.startLineNumber, range.startColumn);
    }
}
