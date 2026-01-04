import { FindMatch } from '../../common/model';
import { View } from '../view';
import { JSONModel } from '../../model/jsonModel';
import { IModelContentChangeEvent } from '../../common/emitterEvents';

/**
 * SearchWidget 类用于管理 JSON Viewer 中的查找和替换功能
 */
export class SearchWidget {
    private _view: View;
    private _jsonModel: JSONModel;
    //TODO: 修改searchResults存储数据结构
    public searchResults: FindMatch[] | null = null;
    public _currentResultIndex: number = -1;
    public matchCase: boolean = false;
    public wordSeparators: string | null = null;
    public isRegex: boolean = false;

    constructor(view: View, jsonModel: JSONModel) {
        this._view = view;
        this._jsonModel = jsonModel;
    }

    public search(searchText: string, caseSensitive: boolean, wholeWord: boolean, regex: boolean): void {
        this._currentResultIndex = -1;
        const isRegex = regex;
        const matchCase = caseSensitive;
        const wordSeparators = !wholeWord ? this.wordSeparators : '`~!@#$%^&*()-=+[{]}\\|;:\'",.<>/?';
        const searchScope = null; // 搜索整个文档
        const captureMatches = false;
        const limitResultCount = Infinity;
        this.searchResults = this._jsonModel.findMatches(
            searchText,
            searchScope,
            isRegex,
            matchCase,
            wordSeparators,
            captureMatches,
            limitResultCount
        );

        this._view.layout();
    }

    public replace(replaceText: string): void {
        if (!replaceText || !this.searchResults) return;
        if (this._currentResultIndex < 0) {
            this._currentResultIndex = 0;
        }
        const currentMatch = this.searchResults[this._currentResultIndex];
        const startOffset = this._jsonModel.getOffsetAt(
            currentMatch.range.startLineNumber,
            currentMatch.range.startColumn
        );
        const endOffset = this._jsonModel.getOffsetAt(
            currentMatch.range.endLineNumber,
            currentMatch.range.endColumn
        );
        const op: IModelContentChangeEvent = {
            range: currentMatch.range,
            newText: replaceText,
            oldText: this._jsonModel.getValueInRange(currentMatch.range),
            type: 'replace',
            rangeOffset: startOffset,
            rangeLength: endOffset - startOffset,
        };
        this.searchResults.splice(this._currentResultIndex, 1);
        this._jsonModel.applyOperation(op);
    }

    public replaceAll(replaceText: string): void {
        if (!replaceText || !this.searchResults) return;
        const op: IModelContentChangeEvent[] = [];
        for (let i = this.searchResults.length - 1; i >= 0; i--) {
            const match = this.searchResults[i];
            const startOffset = this._jsonModel.getOffsetAt(match.range.startLineNumber, match.range.startColumn);
            const endOffset = this._jsonModel.getOffsetAt(match.range.endLineNumber, match.range.endColumn);
            op.push({
                range: match.range,
                newText: replaceText,
                oldText: this._jsonModel.getValueInRange(match.range),
                type: 'replace',
                rangeOffset: startOffset,
                rangeLength: endOffset - startOffset,
            });
        }
        this.searchResults = null;
        this._jsonModel.applyOperation(op);
    }

    public navigateResults(direction: number): void {
        if (!this.searchResults || this.searchResults.length === 0) return;

        this._currentResultIndex += direction;
        if (this._currentResultIndex < 0) {
            this._currentResultIndex = this.searchResults.length - 1;
        } else if (this._currentResultIndex >= this.searchResults.length) {
            this._currentResultIndex = 0;
        }
        const currentMatch = this.searchResults[this._currentResultIndex];
        if (!currentMatch) return;
        if (
            currentMatch.range.startLineNumber > this._view.startLineNumber + this._view.visibleLineCount ||
            currentMatch.range.startLineNumber < this._view.startLineNumber
        ) {
            this._view.scrollToLine(currentMatch.range.startLineNumber);
        } else {
            this._view.layout();
        }
    }

    public binarySearchByLine(targetLine: number): FindMatch[] | null {
        const matches: FindMatch[] = [];
        if (!this.searchResults) return null;
        // 二分查找第一个匹配的位置
        let left = 0;
        let right = this.searchResults.length - 1;

        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const currentLine = this.searchResults[mid].range.startLineNumber;

            if (currentLine === targetLine) {
                // 找到匹配项，收集所有相同行号的结果
                let i = mid;
                while (i >= 0 && this.searchResults[i].range.startLineNumber === targetLine) {
                    matches.unshift(this.searchResults[i]);
                    i--;
                }
                i = mid + 1;
                while (i < this.searchResults.length && this.searchResults[i].range.startLineNumber === targetLine) {
                    matches.push(this.searchResults[i]);
                    i++;
                }
                return matches;
            }

            if (currentLine < targetLine) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }

        return matches;
    }
}
