import { elt, setStyles } from '../../common/dom';
import { View } from '../view';
import { FoldingModel } from '../../model/foldingModel';

/**
 * FoldWidget 类用于管理 JSON Viewer 中的折叠功能
 */
export class FoldWidget {
    private _view: View;
    private _foldingModel: FoldingModel;
    private _isMouseOver: boolean = false;

    constructor(view: View, foldingModel: FoldingModel) {
        this._view = view;
        this._foldingModel = foldingModel;
        this._attachEventListeners();
    }

    private _attachEventListeners() {
        this._view.lineScrollDom.addEventListener('mouseover', e => {
            this._handleLineNumberHover(e);
        });
        this._view.lineScrollDom.addEventListener('mouseleave', () => {
            this._handleLineNumberContainerLeave();
        });
    }

    private _handleLineNumberHover(e: MouseEvent) {
        this._showFoldingIcon();
        this._isMouseOver = true;
    }

    private _handleLineNumberContainerLeave() {
        this.removeAllFoldingIcons();
        this._isMouseOver = false;
    }

    private _showFoldingIcon() {
        if (this._isMouseOver) return;
        const lineNumberElement = this._view.lineScrollDom.children;
        for (let i = 0; i < lineNumberElement.length; i++) {
            const element: HTMLElement = lineNumberElement[i] as HTMLElement;
            if (this._foldingModel.isFoldable(Number(element.dataset.lineNumber))) {
                element.appendChild(this._createFoldingIcon(Number(element.dataset.lineNumber)));
            }
        }
    }

    private _createFoldSvg(isCollapsed: boolean): SVGElement {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svg.setAttribute('width', '1em');
        svg.setAttribute('height', '1em');
        if (isCollapsed) {
            svg.setAttribute('transform', 'rotate(270)');
        }
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const d = 'M21.8329 6.59139L12.8063 18.9004C12.4068 19.4452 11.5931 19.4452 11.1935 18.9004L2.16693 6.59139C1.68255 5.93086 2.15424 5.00003 2.97334 5.00003L21.0265 5.00003C21.8456 5.00003 22.3173 5.93087 21.8329 6.59139Z';
        path.setAttribute('d', d);
        path.setAttribute('fill', 'var(--semi-color-tertiary)');
        svg.appendChild(path);
        return svg;
    }

    private _createFoldingIcon(lineNumber: number): HTMLElement {
        const foldingIconClass = `${this._view.prefixCls}-folding-icon`;

        const foldingIcon = elt('span', foldingIconClass);
        const isCollapsed = this._foldingModel.isCollapsed(lineNumber);
        foldingIcon.appendChild(this._createFoldSvg(isCollapsed));
        setStyles(foldingIcon, {
            position: 'absolute',
            right: '0',
            top: '0',
            width: '40%',
            height: '100%',
            cursor: 'pointer',
            zIndex: '1',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        });

        foldingIcon.addEventListener('mousedown', e => {
            e.preventDefault(); // 防止文本选择
            e.stopPropagation();
            this._foldingModel.toggleFoldingRange(lineNumber);
            this._view.scalingCellSizeAndPositionManager.resetCell(0);
            this._view.layout();
            this._isMouseOver = false;
        });

        return foldingIcon;
    }

    removeAllFoldingIcons() {
        const foldingIconClass = `${this._view.prefixCls}-folding-icon`;
        const foldingIcons = this._view.lineScrollDom.querySelectorAll(`.${foldingIconClass}`);
        foldingIcons.forEach(icon => icon.remove());
    }
}
