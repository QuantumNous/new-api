import { View } from '../view';
import { Emitter, getEmitter } from '../../common/emitter';
import { elt, setStyles } from '../../common/dom';
import { GlobalEvents } from '../../common/emitterEvents';
/**
 * HoverWidget 类用于管理 JSON Viewer 中的悬浮提示功能
 * 当鼠标悬停在字符串值上时，显示一个自定义的提示框
 */
export class HoverWidget {
    private _view: View;
    private _hoverDom: HTMLElement | null = null;
    private _tooltipDom: HTMLElement;
    private _hoverTimer: number | null = null;
    private emitter: Emitter<GlobalEvents> = getEmitter();

    constructor(view: View) {
        this._view = view;

        this._tooltipDom = this._createTooltipDom();
        this._view.jsonViewerDom.appendChild(this._tooltipDom);
        this._attachEventListeners();
    }

    private _attachEventListeners() {
        this._view.contentDom.addEventListener('mousemove', e => {
            if (e.target instanceof HTMLSpanElement && e.target.classList.contains('semi-json-viewer-string-value')) {
                if (this._hoverDom === e.target) {
                    return;
                }
                this._clearHoverTimer();
                this._hideTooltip();

                this._hoverDom = e.target;
                this._hoverTimer = window.setTimeout(() => {
                    if (this._hoverDom) {
                        this.emitter.emit('hoverNode', {
                            value: this._hoverDom.textContent ?? '',
                            target: this._hoverDom,
                        });
                    }
                }, 700);
            }
        });

        this._view.contentDom.addEventListener('mouseout', e => {
            const relatedTarget = e.relatedTarget as Node;
            if (!this._tooltipDom.contains(relatedTarget)) {
                this._clearHoverTimer();
                this._hideTooltip();
            }
        });

        this._tooltipDom.addEventListener('mouseleave', e => {
            const relatedTarget = e.relatedTarget as Node;
            if (!this._hoverDom?.contains(relatedTarget)) {
                this._hideTooltip();
            }
        });

        this.emitter.on('renderHoverNode', e => {
            this.render(e.el);
        });
    }

    private _clearHoverTimer() {
        if (this._hoverTimer) {
            window.clearTimeout(this._hoverTimer);
            this._hoverTimer = null;
        }
    }

    private _hideTooltip() {
        setStyles(this._tooltipDom, {
            visibility: 'hidden',
        });
        this._tooltipDom.innerHTML = '';
        this._hoverDom = null;
    }

    private _createTooltipDom() {
        const div = elt('div', 'hover-container');
        setStyles(div, {
            visibility: 'hidden',
            position: 'absolute',
            zIndex: '1000',
        });
        return div;
    }

    render(el: HTMLElement) {
        if (!this._hoverDom) return;
        this._tooltipDom.innerHTML = '';
        this._tooltipDom.appendChild(el);

        // 获取必要的位置信息
        const hoverRect = this._hoverDom.getBoundingClientRect();
        const editorRect = this._view.contentDom.getBoundingClientRect();
        const tooltipRect = this._tooltipDom.getBoundingClientRect();

        // 计算水平居中位置
        let left = hoverRect.left - editorRect.left + (hoverRect.width + tooltipRect.width) / 2;
        // 确保不会超出左边界
        left = Math.max(5, left);
        // 确保不会超出右边界
        left = Math.min(left, editorRect.width - tooltipRect.width - 5);

        // 默认显示在上方，距离元素5px
        let top = hoverRect.top - editorRect.top - tooltipRect.height;

        // 如果超出顶部，则显示在下方
        if (hoverRect.top - tooltipRect.height - 5 < editorRect.top) {
            top = hoverRect.top - editorRect.top + hoverRect.height;
        }

        setStyles(this._tooltipDom, {
            visibility: 'visible',
            top: `${top}px`,
            left: `${left}px`,
        });
    }
}
