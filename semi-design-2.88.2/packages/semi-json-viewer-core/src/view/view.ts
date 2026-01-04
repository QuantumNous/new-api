import { JSONModel } from '../model/jsonModel';
import { elt, setStyles } from '../common/dom';
import { createPortal } from 'react-dom';
import {
    Token,
    TOKEN_PROPERTY_NAME,
    TOKEN_VALUE_BOOLEAN,
    TOKEN_VALUE_NULL,
    TOKEN_VALUE_NUMBER,
    TOKEN_VALUE_STRING,
} from '../tokens/tokenize';
import { Emitter, getEmitter } from '../common/emitter';
import { SelectionModel } from '../model/selectionModel';
import { CustomRenderRule, JsonViewerOptions } from '../json-viewer/jsonViewer';
import { getJsonWorkerManager, JsonWorkerManager } from '../worker/jsonWorkerManager';
import { FoldingModel } from '../model/foldingModel';
import { SearchWidget } from './search/searchWidget';
import { EditWidget } from './edit/editWidget';
import { FindMatch } from '../common/model';
import { FoldWidget } from './fold/foldWidget';
import { TokenizationJsonModelPart } from '../tokens/tokenizationJsonModelPart';
import { ScalingCellSizeAndPositionManager } from './virtualized/ScalingCellSizeAndPositionManager';
import { CompleteWidget } from './complete/completeWidget';
import { HoverWidget } from './hover/hoverWidget';
import { GlobalEvents } from '../common/emitterEvents';
import { ErrorWidget } from './error/errorWidget';
import { ViewDOMBuilder } from './viewDOMBuilder';
import { getNodePath, getPathChain, JsonDocument, parseJson } from '../service/parse';
//TODO 实现ViewModel抽离代码

/**
 * View 类用于管理 JSON Viewer 的视图
 */
export class View {
    private _jsonModel: JSONModel;
    private _selectionModel: SelectionModel;
    private _foldingModel: FoldingModel;

    private _options: JsonViewerOptions | undefined;
    public _lineHeight: number;

    private _root: JsonDocument | null = null;
    private _customRenderMap: Map<HTMLElement, any> = new Map();

    private _container: HTMLElement;
    private _jsonViewerDom: HTMLElement;
    private _lineNumberDom: HTMLElement;
    private _lineScrollDom: HTMLElement;
    private _contentDom: HTMLElement;
    private _scrollDom: HTMLElement;

    public startLineNumber: number = 1;
    public visibleLineCount: number = 0;
    private _domBuilder: ViewDOMBuilder;
    public prefixCls: string;

    private _verticalOffsetAdjustment: number = 0;

    private _searchWidget: SearchWidget;
    private _editWidget: EditWidget;
    private _foldWidget: FoldWidget;
    private _completeWidget: CompleteWidget;
    private _hoverWidget: HoverWidget;
    private _errorWidget: ErrorWidget;
    private _jsonWorkerManager: JsonWorkerManager = getJsonWorkerManager();
    private _tokenizationJsonModelPart: TokenizationJsonModelPart;
    private _scalingCellSizeAndPositionManager: ScalingCellSizeAndPositionManager;
    private _customRenderRule: CustomRenderRule[];
    private _measuredHeights: { [index: number]: number } = {};

    private emitter: Emitter<GlobalEvents> = getEmitter();

    constructor(container: HTMLElement, model: JSONModel, options?: JsonViewerOptions) {
        this._container = container;
        this._jsonModel = model;
        this._selectionModel = new SelectionModel(1, 0, this, model);
        this._foldingModel = new FoldingModel(model);

        this._lineHeight = options?.lineHeight || 20;
        this._options = options;
        this._customRenderRule = options?.customRenderRule || null;
        this.prefixCls = options?.prefixCls || 'semi-json-viewer';

        this._domBuilder = new ViewDOMBuilder(this._lineHeight, model.getLineCount(), options);

        this._jsonViewerDom = this._domBuilder.createRenderContainer();
        this._lineNumberDom = this._domBuilder.createLineNumberContainer();
        this._contentDom = this._domBuilder.createContentContainer();
        this._scrollDom = this._domBuilder.createScrollElement();
        this._lineScrollDom = this._domBuilder.createLineScrollContainer();

        this._contentDom.appendChild(this._scrollDom);
        this._lineNumberDom.appendChild(this._lineScrollDom);
        this._jsonViewerDom.appendChild(this._lineNumberDom);
        this._jsonViewerDom.appendChild(this._contentDom);
        this._container.appendChild(this._jsonViewerDom);

        this._searchWidget = new SearchWidget(this, this._jsonModel);
        this._foldWidget = new FoldWidget(this, this._foldingModel);
        this._editWidget = new EditWidget(this, this._jsonModel, this._selectionModel);
        this._completeWidget = new CompleteWidget(this, this._jsonModel, this._selectionModel);
        this._hoverWidget = new HoverWidget(this);
        this._errorWidget = new ErrorWidget(this);

        this._tokenizationJsonModelPart = new TokenizationJsonModelPart(this._jsonModel);

        this._scalingCellSizeAndPositionManager = new ScalingCellSizeAndPositionManager({
            cellCount: this._jsonModel.getLineCount(),
            cellSizeGetter: ({ index }) => this.getCellSize(index),
            estimatedCellSize: this._lineHeight,
        });

        this._attachEventListeners();
    }

    get tokenizationJsonModelPart() {
        return this._tokenizationJsonModelPart;
    }

    get contentDom() {
        return this._contentDom;
    }

    get jsonViewerDom() {
        return this._jsonViewerDom;
    }

    get scrollDom() {
        return this._scrollDom;
    }

    get lineScrollDom() {
        return this._lineScrollDom;
    }

    get options() {
        return this._options;
    }

    get completeWidget() {
        return this._completeWidget;
    }

    get editWidget() {
        return this._editWidget;
    }

    get scalingCellSizeAndPositionManager() {
        return this._scalingCellSizeAndPositionManager;
    }

    get searchWidget() {
        return this._searchWidget;
    }

    public dispose() {
        this._container.removeChild(this._jsonViewerDom);
    }

    private _attachEventListeners() {
        if (this._options?.readOnly && this._options.customRenderRule) {
            const { root } = parseJson(this._jsonModel);
            this._root = root;
        }

        this._jsonViewerDom.addEventListener('scroll', e => {
            this.onScroll(this._jsonViewerDom.scrollTop);
        });
        if (this._options?.readOnly) return;
        this._jsonViewerDom.addEventListener('click', e => {
            e.preventDefault();
            this._selectionModel.toLastPosition();
        });

        this._contentDom.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            this._completeWidget.hide();
            this._selectionModel.isSelectedAll = false;
            this._selectionModel.isSelecting = false;
            this._selectionModel.updateFromSelection();
        });

        this.emitter.on('contentChanged', () => {
            this.resetScalingManagerConfigAndCell(0);
            this._measuredHeights = {};
            if (this._jsonModel.lastChangeBufferPos.lineNumber >= this.visibleLineCount + this.startLineNumber) {
                this.scrollToLine(this._jsonModel.lastChangeBufferPos.lineNumber - this.visibleLineCount + 1);
                return;
            }
            this.layout();
        });
        this.emitter.on('forceRender', () => {
            this.resetScalingManagerConfigAndCell(0);
            this.layout();
            this._errorWidget.renderErrorLine();
        });
    }

    public getLineElement(lineNumber: number): HTMLElement | null {
        return this.scrollDom.querySelector(`[data-line-number="${lineNumber}"]`);
    }

    public updateVisibleRange(start: number, end: number) {
        this.startLineNumber = start;
        this.visibleLineCount = end - start + 1;
    }

    public onScroll(scrollTop: number) {
        this._jsonViewerDom.scrollTop = scrollTop;
        this.layout();
        this._errorWidget.renderErrorLine();
    }

    public scrollToLine(lineNumber: number): void {
        const scrollTop = (lineNumber - 1) * this._lineHeight;
        this._contentDom.scrollTop = scrollTop;
        this.onScroll(scrollTop);
    }

    private createLineNumberElement(actualLineNumber: number, visibleLineNumber: number): HTMLElement {
        const lineNumberClass = `${this.prefixCls}-line-number`;
        const lineNumberElement = elt('div', lineNumberClass);
        const rowDatum = this._scalingCellSizeAndPositionManager.getSizeAndPositionOfCell(visibleLineNumber);
        setStyles(lineNumberElement, {
            position: 'absolute',
            width: '50px',
            height: `${this._lineHeight}px`,
            lineHeight: `${this._lineHeight}px`,
            top: `${rowDatum.offset + this._verticalOffsetAdjustment}px`,
        });
        const lineNumber = elt('span', 'line-number-text', {
            position: 'absolute',
            left: '0',
            top: '0',
            textAlign: 'right',
            width: '60%',
            height: '100%',
        });
        lineNumber.innerHTML = actualLineNumber.toString();
        lineNumberElement.appendChild(lineNumber);
        lineNumberElement.dataset.lineNumber = actualLineNumber.toString();
        return lineNumberElement;
    }

    private createLineContentElement(actualLineNumber: number, visibleLineNumber: number): HTMLElement {
        const lineElementClass = `${this.prefixCls}-view-line`;
        const lineElement = elt('div', lineElementClass);
        lineElement.setAttribute('data-line-element', 'true');
        
        const rowDatum = this._scalingCellSizeAndPositionManager.getSizeAndPositionOfCell(visibleLineNumber);
        setStyles(lineElement, {
            lineHeight: `${this._lineHeight}px`,
            width: '100%',
            position: 'absolute',
            top: `${rowDatum.offset + this._verticalOffsetAdjustment}px`,
        });
        
        if (!this._options?.autoWrap) {
            lineElement.style.height = `${this._lineHeight}px`;
        }
        
        lineElement.dataset.lineNumber = actualLineNumber.toString();
        // @ts-ignore
        lineElement.lineNumber = actualLineNumber;
        return lineElement;
    }

    private getCellSize(index: number): number {
        if (this._options?.autoWrap) {
            return this._measuredHeights[index] || this._lineHeight;
        }
        return this._lineHeight;
    }

    private _measureAndUpdateItemHeight(item: HTMLElement, index: number) {
        const height = item.offsetHeight;
        const width = item.children[0].getBoundingClientRect().width * 2;
        
        if (!this._options?.autoWrap && width > this._scrollDom.offsetWidth) {
            this._scrollDom.style.width = `${width}px`;
        }
        if (height === 0) {
            item.style.height = `${this._lineHeight}px`;
            return;
        }
        if (height !== this._measuredHeights[index]) {
            this._measuredHeights[index] = height;
            this._scalingCellSizeAndPositionManager.resetCell(index);
            this._scalingCellSizeAndPositionManager.getSizeAndPositionOfCell(index);
            this._scrollDom.style.height = `${this._scalingCellSizeAndPositionManager.getTotalSize()}px`;
        }
    }

    private clearContainers() {
        this._lineScrollDom.innerHTML = '';
        this._scrollDom.innerHTML = '';
    }

    public resetScalingManagerConfigAndCell(index: number) {
        this._scalingCellSizeAndPositionManager.configure({
            cellCount: this._jsonModel.getLineCount(),
            cellSizeGetter: ({ index }) => this.getCellSize(index),
            estimatedCellSize: this._lineHeight,
        });
        this._scalingCellSizeAndPositionManager.resetCell(index);
    }

    public layout() {
        this.clearContainers();
        this._customRenderMap.clear();

        const visibleLineCount = this._foldingModel.getVisibleLineCount();
        this._scalingCellSizeAndPositionManager.configure({
            cellCount: visibleLineCount,
            cellSizeGetter: ({ index }) => this.getCellSize(index),
            estimatedCellSize: this._lineHeight,
        });

        const visibleRange = this._scalingCellSizeAndPositionManager.getVisibleCellRange({
            containerSize: this._container.clientHeight,
            offset: this._jsonViewerDom.scrollTop,
        });

        const verticalOffsetAdjustment = this._scalingCellSizeAndPositionManager.getOffsetAdjustment({
            containerSize: this._container.clientHeight,
            offset: this._jsonViewerDom.scrollTop,
        });
        this._verticalOffsetAdjustment = verticalOffsetAdjustment;
        this.renderVisibleLines(visibleRange.start!, visibleRange.stop!);
        this.updateVisibleRange(visibleRange.start! + 1, visibleRange.stop! + 1);

        if (!this._options?.readOnly) {
            this._selectionModel.toViewPosition();
            this._completeWidget.show();
        }
        const totalSize = this._scalingCellSizeAndPositionManager.getTotalSize();
        this._scrollDom.style.height = `${totalSize}px`;
        this._lineScrollDom.style.height = `${totalSize}px`;
        if (this._options?.readOnly && this._customRenderMap.size > 0) {
            this._customRenderMap.forEach((value, key) => {
                key.innerHTML = '';
            });
            this.emitter.emit('customRender', {
                customRenderMap: this._customRenderMap
            });
        }
    }

    private renderVisibleLines(startVisibleLine: number, endVisibleLine: number) {
        this._tokenizationJsonModelPart.forceTokenize(endVisibleLine + 1);
        let actualLineNumber = this._foldingModel.getActualLineNumber(startVisibleLine + 1);
        let visibleLineNumber = startVisibleLine;
        while (visibleLineNumber <= endVisibleLine && actualLineNumber <= this._jsonModel.getLineCount()) {
            if (!this._foldingModel.isLineCollapsed(actualLineNumber)) {
                this.renderLine(actualLineNumber, visibleLineNumber);
                visibleLineNumber++;
            }
            actualLineNumber = this._foldingModel.getNextVisibleLine(actualLineNumber);
        }
    }

    private renderLine(actualLineNumber: number, visibleLineNumber: number) {
        const line = this._jsonModel.getLineContent(actualLineNumber);

        const tokens = this._tokenizationJsonModelPart.getLineTokens(actualLineNumber);

        const lineNumberElement = this.renderLineNumber(actualLineNumber, visibleLineNumber);
        const lineElement = this.renderLineContent(actualLineNumber, visibleLineNumber, tokens, line);
    }

    private renderLineNumber(actualLineNumber: number, visibleLineNumber: number) {
        const lineNumberElement = this.createLineNumberElement(actualLineNumber, visibleLineNumber);
        this._lineScrollDom.appendChild(lineNumberElement);
        return lineNumberElement;
    }

    private renderLineContent(actualLineNumber: number, visibleLineNumber: number, tokens: Token[], line: string) {
        const lineElement = this.createLineContentElement(actualLineNumber, visibleLineNumber);
        const contentContainer = this.renderTokensWithHighlight(tokens, line, actualLineNumber);
        lineElement.appendChild(contentContainer);
        this._scrollDom.appendChild(lineElement);
    
        this._measureAndUpdateItemHeight(lineElement, visibleLineNumber);
        return lineElement;
    }
    

    private renderTokensWithHighlight(tokens: Token[], text: string, lineNumber: number): HTMLElement {
        const container = document.createElement('span');
        let currentOffset = 0;
    
        const searchResults = this._searchWidget.binarySearchByLine(lineNumber);
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const start = token.startIndex;
            const end = i + 1 < tokens.length ? tokens[i + 1].startIndex : text.length;
            let content = text.substring(start, end);
    
            if (searchResults && searchResults.length > 0) {
                const highlightedSpan = this.createHighlightedContent(content, currentOffset, searchResults, token.scopes);
                container.appendChild(highlightedSpan);
            } else {
                if (this._options?.readOnly && this._tryApplyCustomRender(token.scopes, content)) {
                    const offset = this._jsonModel.getOffsetAt(lineNumber, (start + end) / 2);
                    const node = this._root?.getNodeFromOffset(offset);
                    const path = getNodePath(node);
                    const pathChain = getPathChain(path);
                    const customElement = this._renderCustomToken(content, this._customRenderRule, token, pathChain);
                    if (customElement instanceof HTMLElement) {
                        container.appendChild(customElement);
                        continue;
                    } else if (customElement !== null) {
                        const span = document.createElement('span');
                        span.className = `${this.prefixCls}-${token.scopes}`;
                        span.textContent = content;
                        container.appendChild(span);
                        this._customRenderMap.set(span, customElement);
                        continue;
                    }
                }
    
                const span = document.createElement('span');
                span.className = `${this.prefixCls}-${token.scopes}`;
                span.textContent = content;
                if (!this._options?.autoWrap) {
                    span.style.whiteSpace = 'pre';
                }
                container.appendChild(span);
            }
    
            currentOffset += content.length;
        }
    
        return container;
    }

    private createHighlightedContent(content: string, offset: number, searchResults: FindMatch[], tokenClass: string): HTMLElement {
        const container = document.createElement('span');
        let lastIndex = 0;
    
        for (const match of searchResults) {
            const startIndex = Math.max(0, match.range.startColumn - 1 - offset);
            const endIndex = Math.min(content.length, match.range.endColumn - 1 - offset);
    
            if (startIndex >= content.length || endIndex <= 0) continue;
    
            if (startIndex > lastIndex) {
                const normalSpan = document.createElement('span');
                normalSpan.className = `${this.prefixCls}-${tokenClass}`;
                normalSpan.textContent = content.substring(lastIndex, startIndex);
                container.appendChild(normalSpan);
            }
    
            const highlightSpan = document.createElement('span');
            highlightSpan.textContent = content.substring(startIndex, endIndex);
            
            const currentMatch = this._searchWidget.searchResults?.[this._searchWidget._currentResultIndex];
            const isCurrentMatch = 
                match.range.startLineNumber === currentMatch?.range.startLineNumber &&
                match.range.endLineNumber === currentMatch?.range.endLineNumber &&
                match.range.startColumn === currentMatch?.range.startColumn &&
                match.range.endColumn === currentMatch?.range.endColumn;
    
            highlightSpan.className = `${this.prefixCls}-${tokenClass} ${this.prefixCls}-search-result${
                isCurrentMatch ? ` ${this.prefixCls}-current-search-result` : ''
            }`;
            highlightSpan.dataset.startColumn = match.range.startColumn.toString();
            highlightSpan.dataset.endColumn = match.range.endColumn.toString();
            
            container.appendChild(highlightSpan);
            lastIndex = endIndex;
        }
    
        if (lastIndex < content.length) {
            const remainingSpan = document.createElement('span');
            remainingSpan.className = `${this.prefixCls}-${tokenClass}`;
            remainingSpan.textContent = content.substring(lastIndex);
            container.appendChild(remainingSpan);
        }
    
        return container;
    }

    private _tryApplyCustomRender(tokenClass: string, content: string): boolean {
        if (!this._customRenderRule || this._customRenderRule.length <= 0) return false;
        if (
            tokenClass === TOKEN_VALUE_BOOLEAN ||
            tokenClass === TOKEN_VALUE_NULL ||
            tokenClass === TOKEN_VALUE_STRING ||
            tokenClass === TOKEN_VALUE_NUMBER ||
            tokenClass === TOKEN_PROPERTY_NAME
        ) {
            return true;
        }
        return false;
    }

    private isMatch(content: string, pathChain: string, rule: CustomRenderRule) {
        const match = rule.match;
        if (typeof match === 'function') {
            return match(content, pathChain);
        } else if (typeof match === 'string') {
            return match === content;
        } else if (match instanceof RegExp) {
            return match.test(content);
        }
        return false;
    }

    private _renderCustomToken(content: string, rule: CustomRenderRule[], token: Token, pathChain: string): HTMLElement | null {
        const realContent = content.replace(/^"|"$/g, '');
        for (const item of rule) {
            if (this.isMatch(realContent, pathChain, item)) {
                const element = item.render(content);
                return element;
            }
        }
        return null;
    }
}
