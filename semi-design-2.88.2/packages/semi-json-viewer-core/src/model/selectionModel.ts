import { JSONModel } from './jsonModel';
import { View } from '../view/view';
import { getLineElement } from '../common/dom';
import { Position } from '../common/position';

/**
 * 选择模型，管理JSON的选中范围和选中状态
 */
export class SelectionModel {
    private _row: number;
    private _col: number;
    public startRow: number;
    public startCol: number;
    public endRow: number;
    public endCol: number;
    public preStartRow: number;
    public preStartCol: number;
    public preEndRow: number;
    public preEndCol: number;
    public isCollapsed: boolean;
    public isSelectedAll: boolean = false;
    public isSelecting: boolean = false;
    private _view: View;
    private _jsonModel: JSONModel;
    constructor(row: number, col: number, view: View, jsonModel: JSONModel) {
        this._row = row;
        this._col = col;
        this._view = view;
        this.startRow = row;
        this.startCol = col;
        this.endRow = row;
        this.endCol = col;
        this.isCollapsed = true;
        this._jsonModel = jsonModel;
    }


    updateSelection(row: number, col: number) {
        this._row = row;
        this._col = col;
    }

    getSelection() {
        return {
            row: this._row,
            col: this._col,
        };
    }

    getPosition(): Position {
        return {
            lineNumber: this._row,
            column: this._col,
        } as Position;
    }

    /**
     * 同步 DOM 选区到模型，更新完整选区
     */
    public updateFromSelection() {
        const selection = this._getValidSelection();
        if (!selection) return;
        this.isCollapsed = selection.isCollapsed;
        const startContainer = selection.anchorNode;
        const endContainer = selection.focusNode;

        let { row: row1, col: col1 } = this.convertRangeToModelPosition(startContainer, selection, true);
        let { row: row2, col: col2 } = this.convertRangeToModelPosition(endContainer, selection, false);
        // 保证 row1/col1 是起点，row2/col2 是终点
        if (row1 > row2 || (row1 === row2 && col1 > col2)) {
            [row1, row2] = [row2, row1];
            [col1, col2] = [col2, col1];
        }
        this._setSelection(row1, col1, row2, col2);
        this._jsonModel.lastChangeBufferPos = {
            lineNumber: this._row,
            column: this._col,
        };
    }

    /**
     * 仅更新选区起点（如拖拽选择时）
     */
    public updateFromSelectingStart() {
        const selection = this._getValidSelection();
        if (!selection) return;
        this.isCollapsed = selection.isCollapsed;
        const startContainer = selection.anchorNode;
        let { row, col } = this.convertRangeToModelPosition(startContainer, selection, true);
        this._setSelection(row, col, this.endRow, this.endCol);
    }

    /**
     * 仅更新选区终点（如拖拽选择时）
     */
    public updateFromSelectingEnd() {
        const selection = this._getValidSelection();
        if (!selection) return;
        this.isCollapsed = selection.isCollapsed;
        const endContainer = selection.focusNode;
        let { row, col } = this.convertRangeToModelPosition(endContainer, selection, false);
        this._setSelection(this.startRow, this.startCol, row, col);
        this._jsonModel.lastChangeBufferPos = {
            lineNumber: this._row,
            column: this._col,
        };
    }

    /**
     * 获取有效的 Selection 对象
     */
    private _getValidSelection(): Selection | null {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || !selection.anchorNode || !selection.focusNode) {
            return null;
        }
        return selection;
    }

    /**
     * 批量设置选区
     */
    private _setSelection(startRow: number, startCol: number, endRow: number, endCol: number) {
        this._row = startRow;
        this._col = startCol;
        this.startRow = startRow;
        this.startCol = startCol;
        this.endRow = endRow;
        this.endCol = endCol;
    }

    public toViewPosition() {
        const selection = window.getSelection();
        if (!selection) return;
        const range = new Range();

        if (this.isSelectedAll) {
            range.setStartBefore(this._view.scrollDom.firstChild!);
            range.setEndAfter(this._view.scrollDom.lastChild!);
            selection.removeAllRanges();
            selection.addRange(range);
            return;
        }

        const row = this._jsonModel.lastChangeBufferPos.lineNumber;
        const col = this._jsonModel.lastChangeBufferPos.column - 1;

        if (this.isSelecting) {
            
        }

        const lineElement = this._view.getLineElement(row);
        
        if (!lineElement) return;
        
        if (col === 0) {
            range.setStart(lineElement, 0);
            range.setEnd(lineElement, 0);
        } else {
            const walker = document.createTreeWalker(
                lineElement,
                NodeFilter.SHOW_TEXT,
                null
            );

            let node: Text | null = walker.nextNode() as Text;
            let currentOffset = 0;
            
            while (node) {
                const nodeLength = node.length;
                if (currentOffset + nodeLength >= col) {
                    range.setStart(node, col - currentOffset);
                    range.setEnd(node, col - currentOffset);
                    break;
                }
                currentOffset += nodeLength;
                node = walker.nextNode() as Text;
            }
        }

        selection.removeAllRanges();
        selection.addRange(range);
    }

    public toLastPosition() {
        this.isCollapsed = true;
        this.isSelectedAll = false;
        const lineCount = this._jsonModel.getLineCount();
        const lineLength = this._jsonModel.getLineLength(lineCount);
        this._row = lineCount;
        this._col = lineLength + 1;
        this.startRow = lineCount;
        this.startCol = lineLength + 1;
        this.endRow = lineCount;
        this.endCol = lineLength + 1;
        this._jsonModel.lastChangeBufferPos = {
            lineNumber: lineCount,
            column: lineLength + 1,
        };
        this.toViewPosition();
    }

    public convertRangeToModelPosition(node: Node, selection: Selection, isStart: boolean) {
        let row = 1;
        let col = 0;
        if (!node) return { row, col };
        
        let lineElement: HTMLElement | null;
        if (node instanceof HTMLElement) {
            lineElement = node.closest(`.${this._view.prefixCls}-view-line`);
        } else {
            lineElement = getLineElement(node);
            if (!lineElement) return { row, col };

            const walker = document.createTreeWalker(
                lineElement,
                NodeFilter.SHOW_TEXT,
                null
            );

            let currentNode: Text | null = walker.nextNode() as Text;
            let totalOffset = 0;
            
            while (currentNode) {
                if (currentNode === node) {
                    totalOffset += isStart ? selection.anchorOffset : selection.focusOffset;
                    break;
                }
                if (currentNode.parentNode === node.parentNode) {
                    if (currentNode === node) {
                        totalOffset += isStart ? selection.anchorOffset : selection.focusOffset;
                        break;
                    }
                }
                
                totalOffset += currentNode.length;
                currentNode = walker.nextNode() as Text;
            }
            
            col = totalOffset;
        }
        row = (lineElement as any)?.lineNumber || 1;
        return { row, col: col + 1 };
    }

    public savePreviousSelection() {
        this.preStartRow = this.startRow;
        this.preStartCol = this.startCol;
        this.preEndRow = this.endRow;
        this.preEndCol = this.endCol;
    }

    public restorePreviousSelection() {
        this.startRow = this.preStartRow;
        this.startCol = this.preStartCol;
        this.endRow = this.preEndRow;
        this.endCol = this.preEndCol;
        this._jsonModel.lastChangeBufferPos = {
            lineNumber: this.startRow,
            column: this.startCol,
        };
    }
    
}

