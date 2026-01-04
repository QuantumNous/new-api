import BaseFoundation, { DefaultAdapter } from '../base/foundation';

export function clampValueInRange(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

export interface DragMoveAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    getDragElement: () => HTMLElement;
    getConstrainer: () => HTMLElement | null;
    getHandler: () => HTMLElement;
    notifyMouseDown?: (e: MouseEvent) => void;
    notifyMouseMove?: (e: MouseEvent) => void;
    notifyMouseUp?: (e: MouseEvent) => void;
    notifyTouchStart?: (e: TouchEvent) => void;
    notifyTouchMove?: (e: TouchEvent) => void;
    notifyTouchEnd?: (e: TouchEvent) => void;
    notifyTouchCancel?: (e: TouchEvent) => void
}

export default class DragMoveFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<DragMoveAdapter<P, S>, P, S> {
    element: HTMLElement;
    xMax: number;
    xMin: number;
    yMax: number;
    yMin: number;
    startOffsetX: number;
    startOffsetY: number;

    get constrainer() {
        return this._adapter.getConstrainer();
    }

    get handler() {
        return this._adapter.getHandler();
    }
    
    constructor(adapter: DragMoveAdapter<P, S>) {
        super({ ...adapter });
    }

    init() {
        const element = this._adapter.getDragElement();
        if (!element) {
            throw new Error('drag element must be a valid element');
        }
        this.element = element;
        this.element.style.position = 'absolute';
        this.handler.style.cursor = 'move';
        this._registerStartEvent();
    }

    _registerStartEvent = () => {
        this.handler.addEventListener('mousedown', this.onMouseDown);
        this.handler.addEventListener('touchstart', this.onTouchStart);
    }

    _unRegisterStartEvent = () => {
        this.handler.removeEventListener('mousedown', this.onMouseDown);
        this.handler.removeEventListener('touchstart', this.onTouchStart);
    }

    destroy() {
        this._unRegisterStartEvent();
        this._unRegisterEvent();
    }

    _registerDocMouseEvent = () => {
        document.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('mouseup', this._onMouseUp);
    }

    _unRegisterDocMouseEvent = () => {
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('mouseup', this._onMouseUp);
    }

    _registerDocTouchEvent = () => {
        document.addEventListener('touchend', this._onTouchEnd);
        document.addEventListener('touchmove', this._onTouchMove);
        document.addEventListener('touchcancel', this._onTouchCancel);
    }

    _unRegisterDocTouchEvent = () => {
        document.removeEventListener('touchend', this._onTouchEnd);
        document.removeEventListener('touchmove', this._onTouchMove);
        document.removeEventListener('touchcancel', this._onTouchCancel);
    }

    _unRegisterEvent() {
        this._unRegisterDocMouseEvent();

        this._unRegisterDocTouchEvent();
    }

    _calcMoveRange() {
        // Calculate the range within which an element can move
        if (this.constrainer) {
            let node = this.element.offsetParent as HTMLElement;
            let startX = 0;
            let startY = 0;
            while (node !== this.constrainer && node !== null) {
                startX -= node.offsetLeft;
                startY -= node.offsetTop;
                node = node.offsetParent as any;
            }
            this.xMin = startX;
            this.xMax = startX + this.constrainer.offsetWidth - this.element.offsetWidth;
            this.yMin = startY;
            this.yMax = startY + this.constrainer.offsetHeight - this.element.offsetHeight;
        }
    }

    _allowMove(e: MouseEvent | TouchEvent) {
        const { allowMove, allowInputDrag } = this.getProps();
        // When the clicked object is an input or textarea, clicking should be allowed but dragging should not be allowed.
        if (!allowInputDrag) {
            let target = (e.target as HTMLElement).tagName.toLowerCase();
            if (target === 'input' || target === 'textarea') {
                return;
            }
        }
        if (allowMove) {
            return allowMove(e, this.element);
        }
        return true;
    }

    _calcOffset = (e: Touch | MouseEvent) => {
        this.startOffsetX = e.clientX - this.element.offsetLeft;
        this.startOffsetY = e.clientY - this.element.offsetTop;
    }

    _preventDefault = (e: MouseEvent | TouchEvent) => {
        // prevent default behavior, avoid other element(like img, text) be selected
        e.preventDefault();
    }

    onMouseDown = (e: MouseEvent) => {
        this._calcMoveRange();
        this._adapter.notifyMouseDown(e);
        if (!this._allowMove(e)) {
            return;
        }
        this._registerDocMouseEvent();
        // store origin offset
        this._calcOffset(e);
        this._preventDefault(e);
    }

    onTouchStart = (e: TouchEvent) => {
        this._calcMoveRange();
        this._adapter.notifyTouchStart(e);
        if (!this._allowMove(e)) {
            return;
        }
        this._registerDocTouchEvent();
        const touch = e.targetTouches[0];
        this._calcOffset(touch);
        this._preventDefault(e);
    }

    _changePos = (e: Touch | MouseEvent) => {
        const { customMove } = this.getProps();
        let newLeft = e.clientX - this.startOffsetX;
        let newTop = e.clientY - this.startOffsetY;
        if (this.constrainer) {
            newLeft = clampValueInRange(newLeft, this.xMin, this.xMax);
            newTop = clampValueInRange(newTop, this.yMin, this.yMax); 
        }

        requestAnimationFrame(() => {
            if (customMove) {
                customMove(this.element, newTop, newLeft);
                return;
            }
            this.element.style.top = newTop + 'px';
            this.element.style.left = newLeft + 'px';
        }); 
    }

    _onMouseMove = (e: MouseEvent) => {
        this._adapter.notifyMouseMove(e);
        this._changePos(e); 
    }

    _onTouchMove = (e: TouchEvent) => {
        this._adapter.notifyTouchMove(e);
        const touch = e.targetTouches[0];
        this._changePos(touch);
    }

    _onMouseUp = (e: MouseEvent) => {
        this._adapter.notifyMouseUp(e);
        this._unRegisterDocMouseEvent();
    }

    _onTouchEnd = (e: TouchEvent) => {
        this._adapter.notifyTouchEnd(e);
        this._unRegisterDocTouchEvent();
    }

    _onTouchCancel = (e: TouchEvent) => {
        this._adapter.notifyTouchCancel(e);
        this._unRegisterDocTouchEvent();
    }
}
