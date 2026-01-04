/** based on https://github.com/microsoft/vscode with modifications for custom requirements */

/**
 * A position in the editor. This interface is suitable for serialization.
 */
export interface IPosition {
    /**
     * line number (starts at 1)
     */
    readonly lineNumber: number;
    /**
     * column (the first character in a line is between column 1 and column 2)
     */
    readonly column: number
}

/**
 * A position in the editor.
 */
export class Position {
    /**
     * line number (starts at 1)
     */
    public readonly lineNumber: number;
    /**
     * column (the first character in a line is between column 1 and column 2)
     */
    public readonly column: number;

    constructor(lineNumber: number, column: number) {
        this.lineNumber = lineNumber;
        this.column = column;
    }

}
