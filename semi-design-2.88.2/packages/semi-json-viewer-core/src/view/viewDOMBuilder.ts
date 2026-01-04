import { elt, setStyles } from '../common/dom';
import { JsonViewerOptions } from '../json-viewer/jsonViewer';

export class ViewDOMBuilder {
    private _lineHeight: number;
    private _options?: JsonViewerOptions;
    private _totalLines: number;
    public prefixCls: string;

    constructor(lineHeight: number, totalLines: number, options?: JsonViewerOptions) {
        this._lineHeight = lineHeight;
        this._totalLines = totalLines;
        this._options = options;
        this.prefixCls = options?.prefixCls || 'semi-json-viewer';
    }

    public createRenderContainer(): HTMLElement {
        const renderContainer = elt('div', 'json-viewer-container');
        setStyles(renderContainer, {
            position: 'relative',
            height: '100%',
            width: '100%',
            overflow: 'auto',
        });
        return renderContainer;
    }

    public createLineNumberContainer(): HTMLElement {
        const lineNumberClass = `${this._options?.prefixCls}-line-number-container`;
        const lineNumberContainer = elt('div', lineNumberClass);
        setStyles(lineNumberContainer, {
            position: 'absolute',
            left: '0',
            top: '0',
            width: '50px',
        });
        return lineNumberContainer;
    }

    public createContentContainer(): HTMLElement {
        const contentClass = `${this.prefixCls}-content-container`;
        const contentContainer = elt('div', contentClass);
        setStyles(contentContainer, {
            position: 'absolute',
            left: '50px',
            top: '0',
            right: '0',
            overflowX: 'auto',
            overflowY: 'scroll',
            outline: 'none',
        });

        if (!this._options?.readOnly) {
            contentContainer.contentEditable = 'true';
            contentContainer.style.caretColor = 'black';
            contentContainer.spellcheck = false;
        }
        return contentContainer;
    }

    public createScrollElement(): HTMLElement {
        const scrollEl = elt('div', 'lines-content');
        setStyles(scrollEl, {
            position: 'relative',
            overflow: 'hidden',
            top: '0',
            left: '0',
            tabSize: (this._options?.formatOptions?.tabSize || 4).toString(),
            height: `${this._lineHeight * this._totalLines}px`,
        });
        
        if (this._options?.autoWrap) {
            scrollEl.style.width = '100%';
        }
        return scrollEl;
    }

    public createLineScrollContainer(): HTMLElement {
        const lineScrollContainer = elt('div', 'line-scroll-container');
        setStyles(lineScrollContainer, {
            position: 'absolute',
            top: '0',
            left: '0',
            height: `${this._lineHeight * this._totalLines}px`,
            width: '100%',
            overflow: 'hidden',
        });
        return lineScrollContainer;
    }
}
