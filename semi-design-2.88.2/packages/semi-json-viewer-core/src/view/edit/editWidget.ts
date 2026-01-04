import { SelectionModel } from '../../model/selectionModel';
import { View } from '../view';
import { JSONModel } from '../../model/jsonModel';
import { applyEdits, Edit } from 'jsonc-parser';
import { getJsonWorkerManager, JsonWorkerManager } from '../../worker/jsonWorkerManager';
import { Emitter, getEmitter } from '../../common/emitter';
import { GlobalEvents, IModelContentChangeEvent } from '../../common/emitterEvents';
import { Range } from '../../common/range';
import { IndentAction, processJsonEnterAction } from './getEnterAction';
import { firstNonWhitespaceIndex, getLeadingWhitespace } from '../../common/strings';
/**
 * EditWidget 类用于管理 JSON Viewer 中的编辑功能
 */
export class EditWidget {
    private _view: View;
    private _selectionModel: SelectionModel;
    private _jsonModel: JSONModel;
    private _isComposition: boolean = false;
    private _autoClosingPairs: Record<string, string> = {
        '{': '}',
        '[': ']',
        '(': ')',
        '"': '"',
    };
    private emitter: Emitter<GlobalEvents> = getEmitter();
    constructor(
        view: View,
        jsonModel: JSONModel,
        selectionModel: SelectionModel,
        private _jsonWorkerManager: JsonWorkerManager = getJsonWorkerManager()
    ) {
        this._view = view;
        this._jsonModel = jsonModel;
        this._selectionModel = selectionModel;

        this.attachEventListeners();
    }

    private attachEventListeners() {
        this._jsonWorkerManager.validate().then(result => {
            this.emitter.emit('problemsChanged', {
                problems: result.problems,
                root: result.root,
            });
        });

        this._view.contentDom.addEventListener('beforeinput', (e: InputEvent) => {
            this._handleBeforeInput(e);
        });

        this._view.contentDom.addEventListener('compositionstart', (e: CompositionEvent) => {
            this._handleCompositionStart(e);
        });

        this._view.contentDom.addEventListener('compositionend', (e: CompositionEvent) => {
            this._handleCompositionEnd(e);
        });

        this._view.contentDom.addEventListener('keydown', (e: KeyboardEvent) => {
            this._handleKeyDown(e);
        });

        this._view.contentDom.addEventListener('mousedown', e => {
            if (e.button !== 0) return; // 只处理左键
            this._selectionModel.isSelecting = true;
            this._selectionModel.updateFromSelectingStart();
        });

        this._view.contentDom.addEventListener('mousemove', e => {
            if (!this._selectionModel.isSelecting) return;
            if (e.button !== 0) return; // 只处理左键
        });

        this._view.contentDom.addEventListener('mouseup', e => {
            if (e.button !== 0) return; // 只处理左键
            this._selectionModel.updateFromSelectingEnd();
        });
    }

    private buildBaseOperation(type: IModelContentChangeEvent['type'] = 'insert') {
        let startRow = this._selectionModel.startRow;
        let startCol = this._selectionModel.startCol;
        let endRow = this._selectionModel.endRow;
        let endCol = this._selectionModel.endCol;

        // 验证并修正位置信息，确保在有效范围内
        const lineCount = this._jsonModel.getLineCount();
        if (startRow > lineCount) {
            startRow = lineCount;
            startCol = this._jsonModel.getLineLength(lineCount) + 1;
        }
        if (endRow > lineCount) {
            endRow = lineCount;
            endCol = this._jsonModel.getLineLength(lineCount) + 1;
        }
        
        // 确保最小值为1
        startRow = Math.max(1, startRow);
        startCol = Math.max(1, startCol);
        endRow = Math.max(1, endRow);
        endCol = Math.max(1, endCol);

        const startOffset = this._jsonModel.getOffsetAt(startRow, startCol);
        const endOffset = this._jsonModel.getOffsetAt(endRow, endCol);
        const op: IModelContentChangeEvent = {
            type,
            range: {
                startLineNumber: startRow,
                startColumn: startCol,
                endLineNumber: endRow,
                endColumn: endCol,
            },
            rangeOffset: startOffset,
            rangeLength: endOffset - startOffset,
            oldText: this._jsonModel.getValueInRange({
                startLineNumber: startRow,
                startColumn: startCol,
                endLineNumber: endRow,
                endColumn: endCol,
            } as Range),
            newText: '',
        };
        if (this._selectionModel.isSelectedAll) {
            op.range = {
                startLineNumber: 1,
                startColumn: 1,
                endLineNumber: this._jsonModel.getLineCount(),
                endColumn: this._jsonModel.getLineLength(this._jsonModel.getLineCount()) + 1,
            };
            op.rangeOffset = 0;
            op.rangeLength = this._jsonModel.getValue().length;
            op.oldText = this._jsonModel.getValue();
        }
        return op;
    }

    private _handleCompositionStart(e: CompositionEvent) {
        e.preventDefault();
        this._isComposition = true;
        this._selectionModel.savePreviousSelection();
    }

    private _handleCompositionEnd(e: CompositionEvent) {
        e.preventDefault();
        this._isComposition = false;
        this._selectionModel.restorePreviousSelection();
        const op = this.buildBaseOperation('replace');
        op.newText = e.data || '';
        this._selectionModel.isSelectedAll = false;
        this._jsonModel.applyOperation(op);
    }

    private _handleBeforeInput(e: InputEvent) {
        if (this._isComposition) return;
        e.preventDefault();
        if (!this._selectionModel.isSelecting) {
            this._selectionModel.updateFromSelection();
        }
        // this._selectionModel.updateFromSelection();
        const op = this.buildBaseOperation();
        const { startLineNumber, startColumn, endLineNumber, endColumn } = op.range;

        switch (e.inputType) {
            case 'insertText':
                if (this._selectionModel.isCollapsed) {
                    op.type = 'insert';
                } else {
                    op.type = 'replace';
                }
                op.newText = e.data || '';
                if (this._autoClosingPairs[op.newText]) {
                    op.newText += this._autoClosingPairs[op.newText];
                    op.keepPosition = {
                        lineNumber: startLineNumber,
                        column: startColumn + 1,
                    };
                }
                break;
            case 'insertParagraph':
                op.newText = '\n';
                op.keepPosition = {
                    lineNumber: startLineNumber + 1,
                    column: 1,
                };
                const enterAction = processJsonEnterAction(this._jsonModel, {
                    startLineNumber: startLineNumber,
                    startColumn: startColumn,
                    endLineNumber: endLineNumber,
                    endColumn: endColumn,
                } as Range);
                if (enterAction) {
                    if (enterAction.indentAction === IndentAction.Indent) {
                        op.newText = '\n' + this.normalizeIndentation(enterAction.appendText + enterAction.indentation) || '';
                        op.keepPosition = {
                            lineNumber: startLineNumber + 1,
                            column: op.newText.length,
                        };
                    } else {
                        const normalIndent = this.normalizeIndentation(enterAction.indentation);
                        const increasedIndent = this.normalizeIndentation(enterAction.indentation + enterAction.appendText);
                        op.newText = '\n' + increasedIndent + '\n' + normalIndent;
                        op.keepPosition = {
                            lineNumber: startLineNumber + 1,
                            column: increasedIndent.length + 1,
                        };
                    }
                } else {
                    const lineText = this._jsonModel.getLineContent(startLineNumber);
                    const indentation = getLeadingWhitespace(lineText).substring(0, startColumn - 1);
                    op.newText = '\n' + this.normalizeIndentation(indentation) || '';
                    op.keepPosition = {
                        lineNumber: startLineNumber + 1,
                        column: op.newText.length,
                    };
                }
                break;
            case 'deleteContentBackward':
                if (this._jsonModel.isStartPosition() && this._selectionModel.isCollapsed) {
                    return;
                }
                if (this._selectionModel.isCollapsed) {
                    op.rangeOffset -= 1;
                    op.oldText = this._jsonModel.getValueInRange({
                        startLineNumber: startLineNumber,
                        startColumn: startColumn - 1,
                        endLineNumber: endLineNumber,
                        endColumn: endColumn,
                    } as Range);
                }
                // if(this._selectionModel.isSelectedAll) {
                //     op.keepPosition = {
                //         lineNumber: startLineNumber + 1,
                //         column: 1,
                //     };
                // }
                op.type = 'delete';
                op.rangeLength = op.oldText.length;
                break;
            case 'insertFromPaste':
                const pasteData = e.dataTransfer?.getData('text/plain');
                op.type = 'replace';
                op.newText = pasteData || '';
                break;
        }
        this._selectionModel.isSelectedAll = false;
        this._selectionModel.isSelecting = false;

        this._jsonModel.applyOperation(op);
    }

    public format() {
        this._jsonWorkerManager
            .formatJson(
                this._view.options?.formatOptions || {
                    tabSize: 2,
                    insertSpaces: true,
                }
            )
            .then((edits: Edit[]) => {
                const newValue = applyEdits(this._jsonModel.getValue(), edits);
                const op: IModelContentChangeEvent = {
                    type: 'replace',
                    range: {
                        startLineNumber: 1,
                        startColumn: 1,
                        endLineNumber: this._jsonModel.getLineCount(),
                        endColumn: this._jsonModel.getLineLength(this._jsonModel.getLineCount()) + 1,
                    },
                    rangeOffset: 0,
                    rangeLength: this._jsonModel.getValue().length,
                    oldText: this._jsonModel.getValue(),
                    newText: newValue,
                };
                this._jsonModel.applyOperation(op);
            });
    }

    private normalizeIndentation(str: string) {
        const indentSize = this._view.options?.formatOptions?.tabSize || 4;
        const insertSpaces = !!this._view.options?.formatOptions?.insertSpaces;
        let firstIndex = firstNonWhitespaceIndex(str);
        if (firstIndex === -1) {
            firstIndex = str.length;
        }
        return (
            this._normalizeIndentationFromWhitespace(str.substring(0, firstIndex), indentSize, insertSpaces) +
            str.substring(firstIndex)
        );
    }

    private _normalizeIndentationFromWhitespace(str: string, indentSize: number, insertSpaces: boolean) {
        let spacesCnt = 0;
        for (let i = 0; i < str.length; i++) {
            if (str.charAt(i) === '\t') {
                spacesCnt = this.nextIndentTabStop(spacesCnt, indentSize);
            } else {
                spacesCnt++;
            }
        }

        let result = '';
        if (!insertSpaces) {
            const tabsCnt = Math.floor(spacesCnt / indentSize);
            spacesCnt = spacesCnt % indentSize;
            for (let i = 0; i < tabsCnt; i++) {
                result += '\t';
            }
        }

        for (let i = 0; i < spacesCnt; i++) {
            result += ' ';
        }

        return result;
    }

    private nextIndentTabStop(spacesCnt: number, indentSize: number) {
        return spacesCnt + indentSize - (spacesCnt % indentSize);
    }

    private _handleKeyDown(e: KeyboardEvent) {
        // this._selectionModel.updateFromSelection();
        
        if (!this._selectionModel.isSelecting) {
            this._selectionModel.updateFromSelection();
        }
        const startRow = this._selectionModel.startRow;
        const startCol = this._selectionModel.startCol;
        const endRow = this._selectionModel.endRow;
        const endCol = this._selectionModel.endCol;
        const startOffset = this._jsonModel.getOffsetAt(startRow, startCol);
        const endOffset = this._jsonModel.getOffsetAt(endRow, endCol);
        const op = this.buildBaseOperation();
        const isCtrl = e.ctrlKey || e.metaKey;
        switch (e.code) {
            case 'Tab':
                if (this._view.completeWidget.isVisible) {
                    e.preventDefault();
                    this._view.completeWidget._handleKeyDown(e);
                    return;
                }
                e.preventDefault();
                let insertText = '';

                if (this._view.options?.formatOptions?.insertSpaces) {
                    const tabSize = this._view.options?.formatOptions?.tabSize || 4;
                    for (let i = 0; i < tabSize; i++) {
                        insertText += ' ';
                    }
                } else {
                    insertText = '\t';
                }
                op.newText = insertText;
                this._jsonModel.applyOperation(op);
                break;
            case 'KeyF':
                if (e.shiftKey && isCtrl) {
                    e.preventDefault();
                    this.format();
                }
                break;
            case 'ArrowRight':
            case 'ArrowLeft':
                if (this._view.completeWidget.isVisible) {
                    this._view.completeWidget.hide();
                }
                break;
            case 'ArrowDown':
            case 'ArrowUp':
                if (this._view.completeWidget.isVisible) {
                    e.preventDefault();
                    this._view.completeWidget._handleKeyDown(e);
                }
                break;
            case 'Enter':
                if (this._view.completeWidget.isVisible) {
                    e.preventDefault();
                    this._view.completeWidget._handleKeyDown(e);
                }
                break;
            case 'KeyA':
                isCtrl && (this._selectionModel.isSelectedAll = true);
                break;
            case 'KeyX':
                isCtrl && (e.preventDefault(), this._cutHandler());
                break;
            case 'KeyZ':
                if (isCtrl && !e.shiftKey) {
                    e.preventDefault();
                    this._jsonModel.undo();
                } else if (isCtrl && e.shiftKey) {
                    e.preventDefault();
                    this._jsonModel.redo();
                }
                break;
            case 'KeyC':
                if (isCtrl) {
                    e.preventDefault();
                    this._copyHandler();
                }
                break;
        }
    }

    private _cutHandler() {
        const op = this.buildBaseOperation('replace');
        if (this._selectionModel.isCollapsed) {
            const { startLineNumber, endLineNumber } = op.range;
            op.rangeOffset = this._jsonModel.getOffsetAt(startLineNumber, 1);
            op.oldText = this._jsonModel.getValueInRange({
                startLineNumber,
                startColumn: 1,
                endLineNumber,
                endColumn: this._jsonModel.getLineLength(endLineNumber) + 1,
            } as Range);
            op.range = {
                startLineNumber,
                startColumn: 1,
                endLineNumber,
                endColumn: this._jsonModel.getLineLength(endLineNumber) + 1,
            };
        }
        navigator.clipboard.writeText(op.oldText);
        this._jsonModel.applyOperation(op);
    }

    private _copyHandler() {
        const op = this.buildBaseOperation('replace');
        navigator.clipboard.writeText(op.oldText);
    }
}
