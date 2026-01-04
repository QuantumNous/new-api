import { GlobalEvents, IModelContentChangeEvent } from '../../common/emitterEvents';
import { elt, setStyles } from '../../common/dom';
import { JSONModel } from '../../model/jsonModel';
import { CompletionItem, CompletionItemKind, TextEdit } from '../../service/jsonTypes';
import { View } from '../view';
import { Emitter, getEmitter } from '../../common/emitter';
import { doValidate, parseJsonAst } from '../../service/jsonService';
import { JSONCompletion } from '../../service/completion';
import { SelectionModel } from '../../model/selectionModel';
import { Position } from '../../common/position';

/**
 * CompleteWidget 类用于管理 JSON Viewer 中的补全功能
 */
export class CompleteWidget {
    private _view: View;
    private _jsonModel: JSONModel;
    private _selectionModel: SelectionModel;
    private _container: HTMLElement;
    private _suggestionsContainer: HTMLElement;
    private _selectedIndex: number = 0;
    private _suggestions: CompletionItem[] = [];
    public isVisible: boolean = false;
    private emitter: Emitter<GlobalEvents> = getEmitter();

    constructor(view: View, jsonModel: JSONModel, selectionModel: SelectionModel) {
        this._view = view;
        this._jsonModel = jsonModel;
        this._selectionModel = selectionModel;

        this._container = this.createCompleteContainer();
        this._suggestionsContainer = this.createSuggestionsContainer();
        this._container.appendChild(this._suggestionsContainer);
        this._view.jsonViewerDom.appendChild(this._container);

        this._attachEventListeners();
    }

    private _attachEventListeners() {
        const shouldTrigger = (e: IModelContentChangeEvent): boolean => {
            // 不是插入操作，不触发
            if (e.type !== 'insert') {
                return false;
            }
            // 不是单个字符，不触发
            if (e.newText.length !== 1) {
                return false;
            }
            // 是空白字符（空格、制表符、换行等），不触发
            if (/\s/.test(e.newText)) {
                return false;
            }
            return true;
        };

        this._suggestionsContainer.addEventListener('click', (e) => {
            this._handleSuggestionClick(e);
        });

        this.emitter.on('contentChanged', e => {
            // 如果是批量操作，直接返回
            if (Array.isArray(e)) {
                return;
            }

            if (!shouldTrigger(e)) {
                // 不符合触发条件时，隐藏补全框
                this.hide();
                return;
            }

            this._fetchCompletions();
        });
    }

    private _fetchCompletions() {
        const root = parseJsonAst(this._jsonModel);
        const position = {
            lineNumber: this._jsonModel.lastChangeBufferPos.lineNumber,
            column: this._jsonModel.lastChangeBufferPos.column,
        } as Position;
        new JSONCompletion(this._view.options?.completionOptions || null)
            .doCompletion(this._jsonModel, position, root)
            .then(completions => {
                this._suggestions = completions.items || [];
                this.show();
            });
    }

    private _calculatePosition(): { x: number; y: number } {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return { x: 0, y: 0 };

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // 获取编辑器容器的位置
        const editorRect = this._view.contentDom.getBoundingClientRect();

        // 计算补全框的位置（相对于编辑器容器）
        const x = rect.left - editorRect.left + 50;
        const y = rect.bottom - editorRect.top;
        return { x, y };
    }

    private createCompleteContainer(): HTMLElement {
        const className = `${this._view.prefixCls}-complete-container`;
        const container = elt('div', className);
        setStyles(container, {
            display: 'none',
        });
        return container;
    }

    private createSuggestionsContainer(): HTMLElement {
        const className = `${this._view.prefixCls}-complete-suggestions-container`;
        const container = elt('div', className);
        setStyles(container, {
            maxHeight: '200px',
            overflowY: 'auto',
        });
        return container;
    }

    public show() {
        if (this._suggestions.length === 0) {
            return;
        }
        const { x, y } = this._calculatePosition();
        if (x < 0 || y < 0) {
            return;
        }
        this.isVisible = true;
        // 更新位置和内容
        setStyles(this._container, {
            left: `${x}px`,
            top: `${y}px`,
            display: 'block',
        });

        // 清空并添加新的建议
        this._suggestionsContainer.innerHTML = '';
        this._renderCompletions();
    }

    public _handleKeyDown = (e: KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this._selectedIndex = (this._selectedIndex + 1) % this._suggestions.length;
                this._renderCompletions();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this._selectedIndex = (this._selectedIndex - 1 + this._suggestions.length) % this._suggestions.length;
                this._renderCompletions();
                break;
            case 'Enter':
            case 'Tab':
                e.preventDefault();
                this.complete();
                break;
        }
    };

    private _handleSuggestionClick(e: MouseEvent) {
        e.preventDefault();
        if (e.target instanceof HTMLLIElement) {
            const index = Number(e.target.getAttribute('data-index'));
            if (!isNaN(index)) {
                this._selectedIndex = index;
                this.complete();
            }
        }
    }

    public complete() {
        const selectedItem = this._suggestions[this._selectedIndex];
        const { textEdit } = selectedItem;
        if (!textEdit) {
            return;
        }
        const { range } = textEdit;
        const startOffset = this._jsonModel.getOffsetAt(range.startLineNumber, range.startColumn);

        const endOffset = this._jsonModel.getOffsetAt(range.endLineNumber, range.endColumn);

        const op: IModelContentChangeEvent = {
            type: 'replace',
            range: {
                startLineNumber: range.startLineNumber,
                startColumn: range.startColumn,
                endLineNumber: range.endLineNumber,
                endColumn: range.endColumn,
            },
            rangeLength: endOffset - startOffset,
            rangeOffset: startOffset,
            oldText: this._jsonModel.getValueInRange(range),
            newText: textEdit?.newText || '',
        };
        this._jsonModel.applyOperation(op);
        this.hide();
    }

    private _renderCompletions() {
        const className = `${this._view.prefixCls}-complete-suggestions-item`;
        this._suggestionsContainer.innerHTML = this._suggestions
            .map(
                (item, index) => `
        <li class="${className}" style="background-color: ${index === this._selectedIndex ? 'var(--semi-color-fill-0)' : 'transparent'
}" data-index="${index}">
            ${item.label}
        </li>
    `
            )
            .join('');
    }

    public hide() {
        if (!this.isVisible) return;
        this.isVisible = false;
        this._container.style.display = 'none';
        this._suggestions = [];
    }
}
