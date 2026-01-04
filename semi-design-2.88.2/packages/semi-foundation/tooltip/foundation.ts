import { get, isEmpty } from 'lodash';
import { DOMRectLikeType } from '../utils/dom';
import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { ArrayElement } from '../utils/type';
import { strings } from './constants';
import { handlePrevent } from '../utils/a11y';

const REGS = {
    TOP: /top/i,
    RIGHT: /right/i,
    BOTTOM: /bottom/i,
    LEFT: /left/i,
};

const defaultRect = {
    left: 0,
    top: 0,
    height: 0,
    width: 0,
    scrollLeft: 0,
    scrollTop: 0,
};

export interface TooltipAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    registerPortalEvent(portalEventSet: any): void;
    registerResizeHandler(onResize: () => void): void;
    unregisterResizeHandler(onResize?: () => void): void;
    on(arg0: string, arg1: () => void): void;
    notifyVisibleChange(isVisible: any): void;
    getPopupContainerRect(): PopupContainerDOMRect;
    containerIsBody(): boolean;
    off(arg0: string, arg1?: () => void): void;
    canMotion(): boolean;
    registerScrollHandler(arg: () => Record<string, any>): void;
    unregisterScrollHandler(): void;
    insertPortal(...args: any[]): void;
    removePortal(...args: any[]): void;
    setDisplayNone: (displayNone: boolean, cb?: () => void) => void;
    getEventName(): {
        mouseEnter: string;
        mouseLeave: string;
        mouseOut: string;
        mouseOver: string;
        click: string;
        focus: string;
        blur: string;
        keydown: string;
        contextMenu: string
    };
    registerTriggerEvent(...args: any[]): void;
    getTriggerBounding(...args: any[]): DOMRect;
    getWrapperBounding(...args: any[]): DOMRect;
    setPosition(...args: any[]): void;
    togglePortalVisible(...args: any[]): void;
    registerClickOutsideHandler(...args: any[]): void;
    unregisterClickOutsideHandler(...args: any[]): void;
    containerIsRelative(): boolean;
    containerIsRelativeOrAbsolute(): boolean;
    getDocumentElementBounding(): DOMRect;
    updateContainerPosition(): void;
    updatePlacementAttr(placement: Position): void;
    getContainerPosition(): string;
    getFocusableElements(node: any): any[];
    getActiveElement(): any;
    getContainer(): any;
    setInitialFocus(): void;
    notifyEscKeydown(event: any): void;
    getTriggerNode(): any;
    setId(): void;
    getTriggerDOM(): HTMLElement|null;
    getAnimatingState(): boolean
}

export type Position = ArrayElement<typeof strings.POSITION_SET>;

export interface PopupContainerDOMRect extends DOMRectLikeType {
    scrollLeft?: number;
    scrollTop?: number
}

export default class Tooltip<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<TooltipAdapter<P, S>, P, S> {
    _timer: ReturnType<typeof setTimeout>;
    _mounted: boolean;

    constructor(adapter: TooltipAdapter<P, S>) {
        super({ ...adapter });
        this._timer = null;
    }

    init() {
        const { wrapperId } = this.getProps();
        this._mounted = true;
        this._bindEvent();
        this._shouldShow();
        if (!wrapperId) {
            this._adapter.setId();
        }
    }

    destroy() {
        this._mounted = false;
        this.unBindEvent();
    }

    _bindEvent() {
        const trigger = this.getProp('trigger'); // get trigger type
        const { triggerEventSet, portalEventSet } = this._generateEvent(trigger);
        this._bindTriggerEvent(triggerEventSet);
        this._bindPortalEvent(portalEventSet);
        this._bindResizeEvent();
    }

    unBindEvent() {
        this._adapter.unregisterClickOutsideHandler();
        this.unBindResizeEvent();
        this.unBindScrollEvent();
        clearTimeout(this._timer);
    }

    _bindTriggerEvent(triggerEventSet: Record<string, any>) {
        this._adapter.registerTriggerEvent(triggerEventSet);
    }


    _bindPortalEvent(portalEventSet: Record<string, any>) {
        this._adapter.registerPortalEvent(portalEventSet);
    }


    _bindResizeEvent() {
        this._adapter.registerResizeHandler(this.onResize);
    }

    unBindResizeEvent() {
        this._adapter.unregisterResizeHandler(this.onResize);
    }
  
    removePortal = () => {
        this._adapter.removePortal();
    }

    setDisplayNone: (displayNone: boolean, cb?: () => void) => void = (displayNone, cb) => {
        this._adapter.setDisplayNone(displayNone, cb);
    }

    _adjustPos(position = '', isVertical = false, adjustType = 'reverse', concatPos?: any) {
        switch (adjustType) {
            case 'reverse':
                return this._reversePos(position, isVertical);
            case 'expand':
                // only happens when position is top/bottom/left/right
                return this._expandPos(position, concatPos);
            case 'reduce':
                // only happens when position other than top/bottom/left/right
                return this._reducePos(position);
            default:
                return this._reversePos(position, isVertical);
        }
    }

    _reversePos(position = '', isVertical = false) {
        if (isVertical) {
            if (REGS.TOP.test(position)) {
                return position.replace('top', 'bottom').replace('Top', 'Bottom');
            } else if (REGS.BOTTOM.test(position)) {
                return position.replace('bottom', 'top').replace('Bottom', 'Top');
            }
        } else if (REGS.LEFT.test(position)) {
            return position.replace('left', 'right').replace('Left', 'Right');
        } else if (REGS.RIGHT.test(position)) {
            return position.replace('right', 'left').replace('Right', 'Left');
        }
        return position;
    }

    _expandPos(position = '', concatPos: string) {
        return position.concat(concatPos);
    }

    _reducePos(position = '') {
        // if cur position consists of two directions, remove the last position
        const found = ['Top', 'Bottom', 'Left', 'Right'].find(pos => position.endsWith(pos));
        return found ? position.replace(found, '') : position;
    }

    clearDelayTimer() {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    }

    updateStateIfCursorOnTrigger = (trigger: HTMLElement) => {
        if (trigger?.matches?.(":hover")) {
            const eventNames = this._adapter.getEventName();
            const triggerEventSet = this.getState("triggerEventSet");
            triggerEventSet[eventNames.mouseEnter]?.();
        }
    }

    _generateEvent(types: ArrayElement<typeof strings.TRIGGER_SET>) {
        const eventNames = this._adapter.getEventName();
        const triggerEventSet = {
            // bind esc keydown on trigger for a11y
            [eventNames.keydown]: (event) => {
                this._handleTriggerKeydown(event);
            },
        };
        let portalEventSet = {};
        switch (types) {
            case 'focus':
                triggerEventSet[eventNames.focus] = () => {
                    this.delayShow();
                };
                triggerEventSet[eventNames.blur] = () => {
                    this.delayHide();
                };
                portalEventSet = triggerEventSet;
                break;
            case 'click':
                triggerEventSet[eventNames.click] = () => {
                    // this.delayShow();
                    this.show();
                };
                portalEventSet = {};
                // Click outside needs special treatment, can not be directly tied to the trigger Element, need to be bound to the document
                break;
            case 'hover':
                triggerEventSet[eventNames.mouseEnter] = () => {
                    // console.log(e);
                    this.setCache('isClickToHide', false);
                    this.delayShow();
                    // this.show('trigger');
                };
                triggerEventSet[eventNames.mouseLeave] = () => {
                    // console.log(e);
                    this.delayHide();
                    // this.hide('trigger');
                };
                // bind focus to hover trigger for a11y
                triggerEventSet[eventNames.focus] = () => {
                    const { disableFocusListener } = this.getProps();
                    !disableFocusListener && this.delayShow();
                };
                triggerEventSet[eventNames.blur] = () => {
                    const { disableFocusListener } = this.getProps();
                    !disableFocusListener && this.delayHide();
                };

                portalEventSet = { ...triggerEventSet };
                if (this.getProp('clickToHide')) {
                    portalEventSet[eventNames.click] = () => {
                        this.setCache('isClickToHide', true);
                        this.hide();
                    };

                    portalEventSet[eventNames.mouseEnter] = () => {
                        if (this.getCache('isClickToHide')) {
                            return;
                        }

                        this.delayShow();
                    };
                }
                break;
            case 'custom':
                // when trigger type is 'custom', no need to bind eventHandler
                // show/hide completely depend on props.visible which change by user
                break;
            case 'contextMenu':
                triggerEventSet[eventNames.contextMenu] = (e) => {
                    e.preventDefault();
                    this.show();
                };
                // Click outside needs special treatment, can not be directly tied to the trigger Element, need to be bound to the document
                break;
            default:
                break;
        }
        return { triggerEventSet, portalEventSet };
    }

    onResize = () => {
        // this.log('resize');
        // rePosition when window resize
        const visible = this.getState('visible');
        if (!visible) {
            return;
        }
        this.calcPosition();
    };

    _shouldShow() { 
        const visible = this.getProp('visible');
        if (visible) {
            this.show();
        } else {
            // this.hide();
        }
    }

    delayShow = () => {
        const mouseEnterDelay: number = this.getProp('mouseEnterDelay');

        this.clearDelayTimer();

        if (mouseEnterDelay > 0) {
            this._timer = setTimeout(() => {
                this.show();
                this.clearDelayTimer();
            }, mouseEnterDelay);
        } else {
            this.show();
        }
    };

    show = () => {
        this._initContainerPosition();
        if (this._adapter.getAnimatingState()) {
            return;
        }
        const content = this.getProp('content');
        const trigger = this.getProp('trigger');

        const clickTriggerToHide = this.getProp('clickTriggerToHide');
        const { visible, displayNone } = this.getStates();
        if (displayNone) {
            this.setDisplayNone(false);
        } 
        if (visible) {
            return ;
        }

        this.clearDelayTimer();

        /**
         * If you emit an event in setState callback, you need to place the event listener function before setState to execute.
         * This is to avoid event registration being executed later than setState callback when setState is executed in setTimeout.
         * internal-issues:1402#note_38969412
         */
        this._adapter.on('portalInserted', () => {
            this.calcPosition();
        });

        if (trigger === "hover") {
            const checkTriggerIsHover = () => {
                const triggerDOM = this._adapter.getTriggerDOM();
                if (trigger && !triggerDOM?.matches?.(":hover")) {
                    this.hide();
                }
                this._adapter.off("portalInserted", checkTriggerIsHover);
            };
            this._adapter.on('portalInserted', checkTriggerIsHover);
        }


        this._adapter.on('positionUpdated', () => {
            this._togglePortalVisible(true);
        });

        this._adapter.insertPortal(content, { left: -9999, top: -9999 }); // offscreen rendering

        if (trigger === 'custom') {
            this._adapter.registerClickOutsideHandler(() => {});
        }

        /**
         * trigger类型是click时，仅当portal被插入显示后，才绑定clickOutsideHandler
         * 因为handler需要绑定在document上。如果在constructor阶段绑定
         * 当一个页面中有多个容器实例时，一次click会触发多个容器的handler
         *
         * When the trigger type is click, clickOutsideHandler is bound only after the portal is inserted and displayed
         * Because the handler needs to be bound to the document. If you bind during the constructor phase
         * When there are multiple container instances in a page, one click triggers the handler of multiple containers
         */
        if (trigger === 'click' || clickTriggerToHide || trigger === 'contextMenu') {
            this._adapter.registerClickOutsideHandler(this.hide);
        }

        this._bindScrollEvent();
        this._bindResizeEvent();
    };

    _togglePortalVisible(isVisible: boolean) {
        const nowVisible = this.getState('visible');
        const isInsert = this.getState("isInsert");
        if (nowVisible !== isVisible || isInsert !== isVisible) {
            this._adapter.togglePortalVisible(isVisible, () => {
                if (isVisible) {
                    this._adapter.setInitialFocus();
                }
                this._adapter.notifyVisibleChange(isVisible);
            });
        }
    }

    _roundPixel(pixel: number) {
        if (typeof pixel === 'number') {
            return Math.round(pixel);
        }

        return pixel;
    }

    calcTransformOrigin(position: Position, triggerRect: DOMRect, translateX: number, translateY: number) {
        if (position && triggerRect && translateX != null && translateY != null) {
            if (this.getProp('transformFromCenter')) {
                if (['topLeft', 'bottomLeft'].includes(position)) {
                    return `${this._roundPixel(triggerRect.width / 2)}px ${-translateY * 100}%`;
                }

                if (['topRight', 'bottomRight'].includes(position)) {
                    return `calc(100% - ${this._roundPixel(triggerRect.width / 2)}px) ${-translateY * 100}%`;
                }

                if (['leftTop', 'rightTop'].includes(position)) {
                    return `${-translateX * 100}% ${this._roundPixel(triggerRect.height / 2)}px`;
                }

                if (['leftBottom', 'rightBottom'].includes(position)) {
                    return `${-translateX * 100}% calc(100% - ${this._roundPixel(triggerRect.height / 2)}px)`;
                }
            }

            return `${-translateX * 100}% ${-translateY * 100}%`;
        }

        return null;
    }

    calcPosStyle(props: {triggerRect: DOMRect; wrapperRect: DOMRect; containerRect: PopupContainerDOMRect; position?: Position; spacing?: number; isOverFlow?: [boolean, boolean]}) {
        const { spacing, isOverFlow } = props;
        const { innerWidth } = window;
        
        const triggerRect = (isEmpty(props.triggerRect) ? props.triggerRect : this._adapter.getTriggerBounding()) || { ...defaultRect as any };
        const containerRect = (isEmpty(props.containerRect) ? props.containerRect : this._adapter.getPopupContainerRect()) || {
            ...defaultRect,
        };
        const wrapperRect = (isEmpty(props.wrapperRect) ? props.wrapperRect : this._adapter.getWrapperBounding()) || { ...defaultRect as any };
        const position = props.position != null ? props.position : this.getProp('position');
        const RAW_SPACING = spacing != null ? spacing : this.getProp('spacing');
        const { arrowPointAtCenter, showArrow, arrowBounding } = this.getProps();
        const pointAtCenter = showArrow && arrowPointAtCenter;

        let SPACING = RAW_SPACING;
        let ANO_SPACING = 0;
        if (typeof RAW_SPACING !== 'number') {
            // extended spacing api with {x: number, y: number}, the axes of the spacing is determined based on the position
            const isTopOrBottom = position.includes('top') || position.includes('bottom');
            SPACING = isTopOrBottom ? RAW_SPACING.y : RAW_SPACING.x;
            ANO_SPACING = isTopOrBottom ? RAW_SPACING.x : RAW_SPACING.y;
        }

        const horizontalArrowWidth = get(arrowBounding, 'width', 24);
        const verticalArrowHeight = get(arrowBounding, 'width', 24);
        const arrowOffsetY = get(arrowBounding, 'offsetY', 0);
        const positionOffsetX = 6;
        const positionOffsetY = 6;

        // You must use left/top when rendering, using right/bottom does not render the element position correctly
        // Use left/top + translate to achieve tooltip positioning perfectly without knowing the size of the tooltip expansion layer
        let left;
        let top;
        let translateX = 0; // Container x-direction translation distance
        let translateY = 0; // Container y-direction translation distance

        const middleX = triggerRect.left + triggerRect.width / 2;
        const middleY = triggerRect.top + triggerRect.height / 2;
        const offsetXWithArrow = positionOffsetX + horizontalArrowWidth / 2;
        const offsetYWithArrow = positionOffsetY + verticalArrowHeight / 2;

        const heightDifference = wrapperRect.height - containerRect.height;
        const widthDifference = wrapperRect.width - containerRect.width;

        const offsetHeight = heightDifference > 0 ? heightDifference : 0;
        const offsetWidth = widthDifference > 0 ? widthDifference : 0;
        const isHeightOverFlow = isOverFlow && isOverFlow[0];
        const isWidthOverFlow = isOverFlow && isOverFlow[1];

        const isTriggerNearLeft = middleX - containerRect.left < containerRect.right - middleX;
        const isTriggerNearTop = middleY - containerRect.top < containerRect.bottom - middleY;
        
        const isWrapperWidthOverflow = wrapperRect.width > innerWidth;
        const scaled = Math.abs(wrapperRect?.width - this._adapter.getContainer()?.clientWidth) > 1;
        if (scaled) {
            SPACING = SPACING * wrapperRect.width / this._adapter.getContainer().clientWidth;
        }
        switch (position) {
            case 'top':
                // left = middleX;
                // top = triggerRect.top - SPACING;
                left = isWidthOverFlow ? (isTriggerNearLeft ? containerRect.left + wrapperRect.width / 2 : containerRect.right - wrapperRect.width / 2 + offsetWidth) : middleX + ANO_SPACING;
                top = isHeightOverFlow ? containerRect.bottom + offsetHeight : triggerRect.top - SPACING;
                translateX = -0.5;
                translateY = -1;
                break;
            case 'topLeft':
                // left = pointAtCenter ? middleX - offsetXWithArrow : triggerRect.left;
                // top = triggerRect.top - SPACING;
                left = isWidthOverFlow ? (isWrapperWidthOverflow ? containerRect.left : containerRect.right - wrapperRect.width ) : (pointAtCenter ? middleX - offsetXWithArrow + ANO_SPACING : triggerRect.left + ANO_SPACING);
                top = isHeightOverFlow ? containerRect.bottom + offsetHeight : triggerRect.top - SPACING;
                translateY = -1;
                break;
            case 'topRight':
                // left = pointAtCenter ? middleX + offsetXWithArrow : triggerRect.right;
                // top = triggerRect.top - SPACING;
                left = isWidthOverFlow ? containerRect.right + offsetWidth : (pointAtCenter ? middleX + offsetXWithArrow + ANO_SPACING : triggerRect.right + ANO_SPACING);
                top = isHeightOverFlow ? containerRect.bottom + offsetHeight : triggerRect.top - SPACING;
                translateY = -1;
                translateX = -1;
                break;
            case 'left':
                // left = triggerRect.left - SPACING;
                // top = middleY;
                // left = isWidthOverFlow? containerRect.right - SPACING : triggerRect.left - SPACING;
                left = isWidthOverFlow ? containerRect.right + offsetWidth - SPACING + offsetXWithArrow : triggerRect.left - SPACING;
                top = isHeightOverFlow ? (isTriggerNearTop ? containerRect.top + wrapperRect.height / 2 : containerRect.bottom - wrapperRect.height / 2 + offsetHeight) : middleY + ANO_SPACING;
                translateX = -1;
                translateY = -0.5;
                break;
            case 'leftTop':
                // left = triggerRect.left - SPACING;
                // top = pointAtCenter ? middleY - offsetYWithArrow : triggerRect.top;
                left = isWidthOverFlow ? containerRect.right + offsetWidth - SPACING + offsetXWithArrow : triggerRect.left - SPACING;
                top = isHeightOverFlow ? containerRect.top : (pointAtCenter ? middleY - offsetYWithArrow + ANO_SPACING : triggerRect.top + ANO_SPACING);
                translateX = -1;
                break;
            case 'leftBottom':
                // left = triggerRect.left - SPACING;
                // top = pointAtCenter ? middleY + offsetYWithArrow : triggerRect.bottom;
                left = isWidthOverFlow ? containerRect.right + offsetWidth - SPACING + offsetXWithArrow : triggerRect.left - SPACING;
                top = isHeightOverFlow ? containerRect.bottom + offsetHeight : (pointAtCenter ? middleY + offsetYWithArrow + ANO_SPACING : triggerRect.bottom + ANO_SPACING);
                translateX = -1;
                translateY = -1;
                break;
            case 'bottom':
                // left = middleX;
                // top = triggerRect.top + triggerRect.height + SPACING;
                left = isWidthOverFlow ? (isTriggerNearLeft ? containerRect.left + wrapperRect.width / 2 : containerRect.right - wrapperRect.width / 2 + offsetWidth) : middleX + ANO_SPACING;
                top = isHeightOverFlow ? containerRect.top + offsetYWithArrow - SPACING : triggerRect.top + triggerRect.height + SPACING;
                translateX = -0.5;
                break;
            case 'bottomLeft':
                // left = pointAtCenter ? middleX - offsetXWithArrow : triggerRect.left;
                // top = triggerRect.bottom + SPACING;
                left = isWidthOverFlow ? (isWrapperWidthOverflow ? containerRect.left : containerRect.right - wrapperRect.width ) : (pointAtCenter ? middleX - offsetXWithArrow + ANO_SPACING : triggerRect.left + ANO_SPACING);
                top = isHeightOverFlow ? containerRect.top + offsetYWithArrow - SPACING : triggerRect.top + triggerRect.height + SPACING;
                break;
            case 'bottomRight':
                // left = pointAtCenter ? middleX + offsetXWithArrow : triggerRect.right;
                // top = triggerRect.bottom + SPACING;
                left = isWidthOverFlow ? containerRect.right + offsetWidth : (pointAtCenter ? middleX + offsetXWithArrow + ANO_SPACING : triggerRect.right + ANO_SPACING);
                top = isHeightOverFlow ? containerRect.top + offsetYWithArrow - SPACING : triggerRect.top + triggerRect.height + SPACING;
                translateX = -1;
                break;
            case 'right':
                // left = triggerRect.right + SPACING;
                // top = middleY;
                left = isWidthOverFlow ? containerRect.left - SPACING + offsetXWithArrow : triggerRect.right + SPACING;
                top = isHeightOverFlow ? (isTriggerNearTop ? containerRect.top + wrapperRect.height / 2 : containerRect.bottom - wrapperRect.height / 2 + offsetHeight) : middleY + ANO_SPACING;
                translateY = -0.5;
                break;
            case 'rightTop':
                // left = triggerRect.right + SPACING;
                // top = pointAtCenter ? middleY - offsetYWithArrow : triggerRect.top;
                left = isWidthOverFlow ? containerRect.left - SPACING + offsetXWithArrow : triggerRect.right + SPACING;
                top = isHeightOverFlow ? containerRect.top : (pointAtCenter ? middleY - offsetYWithArrow + ANO_SPACING : triggerRect.top + ANO_SPACING);
                break;
            case 'rightBottom':
                // left = triggerRect.right + SPACING;
                // top = pointAtCenter ? middleY + offsetYWithArrow : triggerRect.bottom;
                left = isWidthOverFlow ? containerRect.left - SPACING + offsetXWithArrow : triggerRect.right + SPACING;
                top = isHeightOverFlow ? containerRect.bottom + offsetHeight : (pointAtCenter ? middleY + offsetYWithArrow + ANO_SPACING : triggerRect.bottom + ANO_SPACING);
                translateY = -1;
                break;
            case 'leftTopOver':
                left = triggerRect.left - SPACING;
                top = triggerRect.top - SPACING;
                break;
            case 'rightTopOver':
                left = triggerRect.right + SPACING;
                top = triggerRect.top - SPACING;
                translateX = -1;
                break;
            case 'leftBottomOver':
                left = triggerRect.left - SPACING;
                top = triggerRect.bottom + SPACING;
                translateY = -1;
                break;
            case 'rightBottomOver':
                left = triggerRect.right + SPACING;
                top = triggerRect.bottom + SPACING;
                translateX = -1;
                translateY = -1;
                break;
            default:
                break;
        }

        const transformOrigin = this.calcTransformOrigin(position, triggerRect, translateX, translateY); // Transform origin

        const _containerIsBody = this._adapter.containerIsBody();
        // Calculate container positioning relative to window
        left = left - containerRect.left;
        top = top - containerRect.top;

        if (scaled) {
            left /= wrapperRect.width / this._adapter.getContainer().clientWidth;
        }

        if (scaled) {
            top /= wrapperRect.height / this._adapter.getContainer().clientHeight;
        }

        /**
         * container为body时，如果position不为relative或absolute，这时trigger计算出的top/left会根据html定位（initial containing block）
         * 此时如果body有margin，则计算出的位置相对于body会有问题 fix issue #1368
         *
         * When container is body, if position is not relative or absolute, then the top/left calculated by trigger will be positioned according to html
         * At this time, if the body has a margin, the calculated position will have a problem relative to the body fix issue #1368
         */
        if (_containerIsBody && !this._adapter.containerIsRelativeOrAbsolute()) {
            const documentEleRect = this._adapter.getDocumentElementBounding();
            // Represents the left of the body relative to html
            left += containerRect.left - documentEleRect.left;
            // Represents the top of the body relative to html
            top += containerRect.top - documentEleRect.top;
        }

        // ContainerRect.scrollLeft to solve the inner scrolling of the container
        left = _containerIsBody ? left : left + containerRect.scrollLeft;
        top = _containerIsBody ? top : top + containerRect.scrollTop;

        const triggerHeight = triggerRect.height;

        if (
            this.getProp('showArrow') &&
            !arrowPointAtCenter &&
            triggerHeight <= (verticalArrowHeight / 2 + arrowOffsetY) * 2
        ) {
            const offsetY = triggerHeight / 2 - (arrowOffsetY + verticalArrowHeight / 2);

            if ((position.includes('Top') || position.includes('Bottom')) && !position.includes('Over')) {
                top = position.includes('Top') ? top + offsetY : top - offsetY;
            }
        }

        // The left/top value here must be rounded, otherwise it will cause the small triangle to shake
        const style: Record<string, string | number> = {
            left: this._roundPixel(left),
            top: this._roundPixel(top),
        };

        let transform = '';

        if (translateX != null) {
            transform += `translateX(${translateX * 100}%) `;
            Object.defineProperty(style, 'translateX', {
                enumerable: false,
                value: translateX,
            });
        }
        if (translateY != null) {
            transform += `translateY(${translateY * 100}%) `;
            Object.defineProperty(style, 'translateY', {
                enumerable: false,
                value: translateY,
            });
        }
        if (transformOrigin != null) {
            style.transformOrigin = transformOrigin;
        }

        if (transform) {
            style.transform = transform;
        }

        return style;
    }


    /**
     * 耦合的东西比较多，稍微罗列一下：
     *
     * - 根据 trigger 和 wrapper 的 boundingClient 计算当前的 left、top、transform-origin
     * - 根据当前的 position 和 wrapper 的 boundingClient 决定是否需要自动调整位置
     * - 根据当前的 position、trigger 的 boundingClient 以及 motion.handleStyle 调整当前的 style
     * 
     * There are many coupling things, a little list:
     *
     * - calculate the current left, top, and transfer-origin according to the boundingClient of trigger and wrapper
     * - decide whether to automatically adjust the position according to the current position and the boundingClient of wrapper
     * - adjust the current style according to the current position, the boundingClient of trigger and motion.handle Style
     */
    calcPosition = (triggerRect?: DOMRect, wrapperRect?: DOMRect, containerRect?: PopupContainerDOMRect, shouldUpdatePos = true) => {
        triggerRect = (isEmpty(triggerRect) ? this._adapter.getTriggerBounding() : triggerRect) || { ...defaultRect as any };
        containerRect = (isEmpty(containerRect) ? this._adapter.getPopupContainerRect() : containerRect) || {
            ...defaultRect,
        };
        wrapperRect = (isEmpty(wrapperRect) ? this._adapter.getWrapperBounding() : wrapperRect) || { ...defaultRect as any };

        // console.log('containerRect: ', containerRect, 'triggerRect: ', triggerRect, 'wrapperRect: ', wrapperRect);

        let style = this.calcPosStyle({ triggerRect, wrapperRect, containerRect });

        let position = this.getProp('position');

        if (this.getProp('autoAdjustOverflow')) {
            // console.log('style: ', style, '\ntriggerRect: ', triggerRect, '\nwrapperRect: ', wrapperRect);
            const { position: adjustedPos, isHeightOverFlow, isWidthOverFlow } = this.adjustPosIfNeed(position, style, triggerRect, wrapperRect, containerRect);

            if (position !== adjustedPos || isHeightOverFlow || isWidthOverFlow) {
                position = adjustedPos;

                style = this.calcPosStyle({ triggerRect, wrapperRect, containerRect, position, spacing: null, isOverFlow: [ isHeightOverFlow, isWidthOverFlow ] });
            }
        }

        if (shouldUpdatePos && this._mounted) {
            // this._adapter.updatePlacementAttr(style.position);
            this._adapter.setPosition({ ...style, position });
        }

        return style;
    };

    isLR(position = '') {
        return position.includes('left') || position.includes('right');
    }

    isTB(position = '') {
        return position.includes('top') || position.includes('bottom');
    }

    isReverse(rowSpace: number, reverseSpace: number, size: number) {
        // 原空间不足，反向空间足够
        // Insufficient original space, enough reverse space
        return rowSpace < size && reverseSpace > size;
    }

    isOverFlow(rowSpace: number, reverseSpace: number, size: number) {
        // 原空间且反向空间都不足
        // The original space and the reverse space are not enough
        return rowSpace < size && reverseSpace < size;
    }

    isHalfOverFlow(posSpace: number, negSpace: number, size: number) {
        // 正半空间或者负半空间不足，即表示有遮挡，需要偏移
        // Insufficient positive half space or negative half space means that there is occlusion and needs to be offset
        return posSpace < size || negSpace < size;
    }

    isHalfAllEnough(posSpace: number, negSpace: number, size: number) {
        // 正半空间和负半空间都足够，即表示可以从 topLeft/topRight 变成 top
        // Both positive and negative half-spaces are sufficient, which means you can change from topLeft/topRight to top
        return posSpace >= size || negSpace >= size;
    }

    getReverse(viewOverFlow: boolean, containerOverFlow: boolean, shouldReverseView: boolean, shouldReverseContainer: boolean) {
        /**
         * 基于视口和容器一起判断，以下几种情况允许从原方向转到反方向，以判断是否应该由top->bottom为例子
         *
         * 1. 视口上下空间不足 且 容器上空间❌下空间✅
         * 2. 视口上空间❌下空间✅
         * 
         * Based on the judgment of the viewport and the container, the following situations are allowed to turn from the original direction to the opposite direction
         * to judge whether it should be top->bottom as an example
         * 1. There is insufficient space above and below the viewport and the space above the container ❌ the space below ✅
         * 2. The space above the viewport ❌ the space below ✅ and the space above and below the container is insufficient
         * 3. Viewport upper space ❌ lower space✅ and container upper space ❌ lower space✅
         */
        return (viewOverFlow && shouldReverseContainer) || shouldReverseView ;
    }

    // place the dom correctly
    adjustPosIfNeed(position: Position | string, style: Record<string, any>, triggerRect: DOMRect, wrapperRect: DOMRect, containerRect: PopupContainerDOMRect) {
        const { innerWidth, innerHeight } = window;
        const { margin } = this.getProps();

        const marginLeft = typeof margin === 'number' ? margin : margin.marginLeft;
        const marginTop = typeof margin === 'number' ? margin : margin.marginTop;
        const marginRight = typeof margin === 'number' ? margin : margin.marginRight;
        const marginBottom = typeof margin === 'number' ? margin : margin.marginBottom;

        let isHeightOverFlow = false;
        let isWidthOverFlow = false;

        const raw_spacing = this.getProp('spacing');
        let spacing = raw_spacing;
        let ano_spacing = 0;
        if (typeof raw_spacing !== 'number') {
            // extended spacing api with {x: number, y: number}, the axes of the spacing is determined based on the position
            const isTopOrBottom = position.includes('top') || position.includes('bottom');
            spacing = isTopOrBottom ? raw_spacing.y : raw_spacing.x;
            ano_spacing = isTopOrBottom ? raw_spacing.x : raw_spacing.y;
        }

        if (wrapperRect.width > 0 && wrapperRect.height > 0) {
            // let clientLeft = left + translateX * wrapperRect.width - containerRect.scrollLeft;
            // let clientTop = top + translateY * wrapperRect.height - containerRect.scrollTop;

            // if (this._adapter.containerIsBody() || this._adapter.containerIsRelative()) {
            //     clientLeft += containerRect.left;
            //     clientTop += containerRect.top;
            // }
            // const clientRight = clientLeft + wrapperRect.width;
            // const clientBottom = clientTop + wrapperRect.height;

            // The relative position of the elements on the screen
            // https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/tooltip-pic.svg
            const clientLeft = triggerRect.left;
            const clientRight = triggerRect.right;
            const clientTop = triggerRect.top;
            const clientBottom = triggerRect.bottom;

            const restClientLeft = innerWidth - clientLeft;
            const restClientTop = innerHeight - clientTop;
            const restClientRight = innerWidth - clientRight;
            const restClientBottom = innerHeight - clientBottom;

            const widthIsBigger = wrapperRect.width > triggerRect.width;
            const heightIsBigger = wrapperRect.height > triggerRect.height;

            // The wrapperR ect.top|bottom equivalent cannot be directly used here for comparison, which is easy to cause jitter

            // 基于视口的微调判断
            // Fine-tuning judgment based on viewport
            const shouldViewReverseTop = clientTop - marginTop < wrapperRect.height + spacing && restClientBottom - marginBottom > wrapperRect.height + spacing;
            const shouldViewReverseLeft = clientLeft - marginLeft < wrapperRect.width + spacing && restClientRight - marginRight > wrapperRect.width + spacing;
            const shouldViewReverseBottom = restClientBottom - marginBottom < wrapperRect.height + spacing && clientTop - marginTop > wrapperRect.height + spacing;
            const shouldViewReverseRight = restClientRight - marginRight < wrapperRect.width + spacing && clientLeft - marginLeft > wrapperRect.width + spacing;
            const shouldViewReverseTopOver = restClientTop - marginBottom < wrapperRect.height + spacing && clientBottom - marginTop > wrapperRect.height + spacing;
            const shouldViewReverseBottomOver = clientBottom - marginTop < wrapperRect.height + spacing && restClientTop - marginBottom > wrapperRect.height + spacing;

            const shouldViewReverseTopSide = restClientTop < wrapperRect.height + ano_spacing && clientBottom > wrapperRect.height + ano_spacing;
            const shouldViewReverseBottomSide = clientBottom < wrapperRect.height + ano_spacing && restClientTop > wrapperRect.height + ano_spacing;
            const shouldViewReverseLeftSide = restClientLeft < wrapperRect.width + ano_spacing && clientRight > wrapperRect.width + ano_spacing;
            const shouldViewReverseRightSide = clientRight < wrapperRect.width + ano_spacing && restClientLeft > wrapperRect.width + ano_spacing;

            const shouldReverseTopOver = restClientTop < wrapperRect.height + spacing && clientBottom > wrapperRect.height + spacing;
            const shouldReverseBottomOver = clientBottom < wrapperRect.height + spacing && restClientTop > wrapperRect.height + spacing;

            const shouldReverseLeftOver = restClientLeft < wrapperRect.width && clientRight > wrapperRect.width;
            const shouldReverseRightOver = clientRight < wrapperRect.width && restClientLeft > wrapperRect.width;

            // 基于容器的微调判断
            // Fine-tuning judgment based on container
            const clientTopInContainer = clientTop - containerRect.top;
            const clientLeftInContainer = clientLeft - containerRect.left;
            const clientBottomInContainer = clientTopInContainer + triggerRect.height;
            const clientRightInContainer = clientLeftInContainer + triggerRect.width;

            const restClientBottomInContainer = containerRect.bottom - clientBottom;
            const restClientRightInContainer = containerRect.right - clientRight;
            const restClientTopInContainer = restClientBottomInContainer + triggerRect.height;
            const restClientLeftInContainer = restClientRightInContainer + triggerRect.width;

            // 当原空间不足，反向空间足够时，可以反向。
            // When the original space is insufficient and the reverse space is sufficient, the reverse can be performed.
            const shouldContainerReverseTop = this.isReverse(clientTopInContainer - marginTop, restClientBottomInContainer - marginBottom, wrapperRect.height + spacing);
            const shouldContainerReverseLeft = this.isReverse(clientLeftInContainer - marginLeft, restClientRightInContainer - marginRight, wrapperRect.width + spacing);
            const shouldContainerReverseBottom = this.isReverse(restClientBottomInContainer - marginBottom, clientTopInContainer - marginTop, wrapperRect.height + spacing);
            const shouldContainerReverseRight = this.isReverse(restClientRightInContainer - marginRight, clientLeftInContainer - marginLeft, wrapperRect.width + spacing);
            const shouldContainerReverseTopOver = this.isReverse(restClientTopInContainer - marginBottom, clientBottomInContainer - marginTop, wrapperRect.height + spacing);
            const shouldContainerReverseBottomOver = this.isReverse(clientBottomInContainer - marginTop, restClientTopInContainer - marginBottom, wrapperRect.height + spacing);

            const shouldContainerReverseTopSide = this.isReverse(restClientTopInContainer, clientBottomInContainer, wrapperRect.height + ano_spacing);
            const shouldContainerReverseBottomSide = this.isReverse(clientBottomInContainer, restClientTopInContainer, wrapperRect.height + ano_spacing);
            const shouldContainerReverseLeftSide = this.isReverse(restClientLeftInContainer, clientRightInContainer, wrapperRect.width + ano_spacing);
            const shouldContainerReverseRightSide = this.isReverse(clientRightInContainer, restClientLeftInContainer, wrapperRect.width + ano_spacing);

            const halfHeight = triggerRect.height / 2;
            const halfWidth = triggerRect.width / 2;
            // 视口, 原空间与反向空间是否都不足判断
            // Viewport, whether the original space and the reverse space are insufficient to judge
            const isViewYOverFlow = this.isOverFlow(clientTop - marginTop, restClientBottom - marginBottom, wrapperRect.height + spacing);
            const isViewXOverFlow = this.isOverFlow(clientLeft - marginLeft, restClientRight - marginRight, wrapperRect.width + spacing);
            const isViewYOverFlowSide = this.isOverFlow(clientBottom - marginTop, restClientTop - marginBottom, wrapperRect.height + spacing);
            const isViewXOverFlowSide = this.isOverFlow(clientRight - marginLeft, restClientLeft - marginRight, wrapperRect.width + spacing);
            const isViewYOverFlowSideHalf = this.isHalfOverFlow(clientBottom - halfHeight, restClientTop - halfHeight, (wrapperRect.height + ano_spacing) / 2);
            const isViewXOverFlowSideHalf = this.isHalfOverFlow(clientRight - halfWidth, restClientLeft - halfWidth, (wrapperRect.width + ano_spacing) / 2);
            const isViewYEnoughSideHalf = this.isHalfAllEnough(clientBottom - halfHeight, restClientTop - halfHeight, (wrapperRect.height + ano_spacing) / 2);
            const isViewXEnoughSideHalf = this.isHalfAllEnough(clientRight - halfWidth, restClientLeft - halfWidth, (wrapperRect.width + ano_spacing) / 2);

            // 容器, 原空间与反向空间是否都不足判断
            // container, whether the original space and the reverse space are insufficient to judge
            const isContainerYOverFlow = this.isOverFlow(clientTopInContainer - marginTop, restClientBottomInContainer - marginBottom, wrapperRect.height + spacing);
            const isContainerXOverFlow = this.isOverFlow(clientLeftInContainer - marginLeft, restClientRightInContainer - marginRight, wrapperRect.width + spacing);
            const isContainerYOverFlowSide = this.isOverFlow(clientBottomInContainer - marginTop, restClientTopInContainer - marginBottom, wrapperRect.height + spacing);
            const isContainerXOverFlowSide = this.isOverFlow(clientRightInContainer - marginLeft, restClientLeftInContainer - marginRight, wrapperRect.width + spacing);
            const isContainerYOverFlowSideHalf = this.isHalfOverFlow(clientBottomInContainer - halfHeight, restClientTopInContainer - halfHeight, (wrapperRect.height + ano_spacing) / 2);
            const isContainerXOverFlowSideHalf = this.isHalfOverFlow(clientRightInContainer - halfWidth, restClientLeftInContainer - halfWidth, (wrapperRect.width + ano_spacing) / 2);
            const isContainerYEnoughSideHalf = this.isHalfAllEnough(clientBottomInContainer - halfHeight, restClientTopInContainer - halfHeight, (wrapperRect.height + ano_spacing) / 2);
            const isContainerXEnoughSideHalf = this.isHalfAllEnough(clientRightInContainer - halfWidth, restClientLeftInContainer - halfWidth, (wrapperRect.width + ano_spacing) / 2);

            // 综合 viewport + container 判断微调，即视口 + 容器都放置不行时才能考虑位置调整
            // Comprehensive viewport + container judgment fine-tuning, that is, the position adjustment can only be considered when the viewport + container cannot be placed.
            const shouldReverseTop = this.getReverse(isViewYOverFlow, isContainerYOverFlow, shouldViewReverseTop, shouldContainerReverseTop);
            const shouldReverseLeft = this.getReverse(isViewXOverFlow, isContainerXOverFlow, shouldViewReverseLeft, shouldContainerReverseLeft);
            const shouldReverseBottom = this.getReverse(isViewYOverFlow, isContainerYOverFlow, shouldViewReverseBottom, shouldContainerReverseBottom);
            const shouldReverseRight = this.getReverse(isViewXOverFlow, isContainerXOverFlow, shouldViewReverseRight, shouldContainerReverseRight);

            // const shouldReverseTopOver = this.getReverse(isViewYOverFlowSide, isContainerYOverFlowSide, shouldViewReverseTopOver, shouldContainerReverseTopOver);
            // const shouldReverseBottomOver = this.getReverse(isViewYOverFlowSide, isContainerYOverFlowSide, shouldViewReverseBottomOver, shouldContainerReverseBottomOver);

            const shouldReverseTopSide = this.getReverse(isViewYOverFlowSide, isContainerYOverFlowSide, shouldViewReverseTopSide, shouldContainerReverseTopSide);
            const shouldReverseBottomSide = this.getReverse(isViewYOverFlowSide, isContainerYOverFlowSide, shouldViewReverseBottomSide, shouldContainerReverseBottomSide);
            const shouldReverseLeftSide = this.getReverse(isViewXOverFlowSide, isContainerXOverFlowSide, shouldViewReverseLeftSide, shouldContainerReverseLeftSide);
            const shouldReverseRightSide = this.getReverse(isViewXOverFlowSide, isContainerXOverFlowSide, shouldViewReverseRightSide, shouldContainerReverseRightSide);

            const isYOverFlowSideHalf = isViewYOverFlowSideHalf && isContainerYOverFlowSideHalf;
            const isXOverFlowSideHalf = isViewXOverFlowSideHalf && isContainerXOverFlowSideHalf;

            switch (position) {
                case 'top':
                    if (shouldReverseTop) {
                        position = this._adjustPos(position, true);
                    }
                    if (isXOverFlowSideHalf && (shouldReverseLeftSide || shouldReverseRightSide)) {
                        position = this._adjustPos(position, true, 'expand', shouldReverseLeftSide ? 'Right' : 'Left');
                    }
                    break;
                case 'topLeft':
                    if (shouldReverseTop) {
                        position = this._adjustPos(position, true);
                    }
                    if (shouldReverseLeftSide && widthIsBigger) {
                        position = this._adjustPos(position);
                    }
                    if (isWidthOverFlow && (isViewXEnoughSideHalf || isContainerXEnoughSideHalf)) {
                        position = this._adjustPos(position, true, 'reduce');
                    }
                    break;
                case 'topRight':
                    if (shouldReverseTop) {
                        position = this._adjustPos(position, true);
                    }
                    if (shouldReverseRightSide && widthIsBigger) {
                        position = this._adjustPos(position);
                    }
                    if (isWidthOverFlow && (isViewXEnoughSideHalf || isContainerXEnoughSideHalf)) {
                        position = this._adjustPos(position, true, 'reduce');
                    }
                    break;
                case 'left':
                    if (shouldReverseLeft) {
                        position = this._adjustPos(position);
                    }
                    if (isYOverFlowSideHalf && (shouldReverseTopSide || shouldReverseBottomSide)) {
                        position = this._adjustPos(position, false, 'expand', shouldReverseTopSide ? 'Bottom' : 'Top');
                    }
                    break;
                case 'leftTop':
                    if (shouldReverseLeft) {
                        position = this._adjustPos(position);
                    }
                    if (shouldReverseTopSide && heightIsBigger) {
                        position = this._adjustPos(position, true); 
                    }
                    if (isHeightOverFlow && (isViewYEnoughSideHalf || isContainerYEnoughSideHalf)) {
                        position = this._adjustPos(position, false, 'reduce');
                    }
                    break;
                case 'leftBottom':
                    if (shouldReverseLeft) {
                        position = this._adjustPos(position);
                    }
                    if (shouldReverseBottomSide && heightIsBigger) {
                        position = this._adjustPos(position, true);
                    }
                    if (isHeightOverFlow && (isViewYEnoughSideHalf || isContainerYEnoughSideHalf)) {
                        position = this._adjustPos(position, false, 'reduce');
                    }
                    break;
                case 'bottom':
                    if (shouldReverseBottom) {
                        position = this._adjustPos(position, true);
                    }
                    if (isXOverFlowSideHalf && (shouldReverseLeftSide || shouldReverseRightSide)) {
                        position = this._adjustPos(position, true, 'expand', shouldReverseLeftSide ? 'Right' : 'Left');
                    }
                    break;
                case 'bottomLeft':
                    if (shouldReverseBottom) {
                        position = this._adjustPos(position, true);
                    }
                    if (shouldReverseLeftSide && widthIsBigger) {
                        position = this._adjustPos(position);
                    }
                    if (isWidthOverFlow && (isViewXEnoughSideHalf || isContainerXEnoughSideHalf)) {
                        position = this._adjustPos(position, true, 'reduce');
                    }
                    break;
                case 'bottomRight':
                    if (shouldReverseBottom) {
                        position = this._adjustPos(position, true);
                    }
                    if (shouldReverseRightSide && widthIsBigger) {
                        position = this._adjustPos(position);
                    }
                    if (isWidthOverFlow && (isViewXEnoughSideHalf || isContainerXEnoughSideHalf)) {
                        position = this._adjustPos(position, true, 'reduce');
                    }
                    break;
                case 'right':
                    if (shouldReverseRight) {
                        position = this._adjustPos(position);
                    }
                    if (isYOverFlowSideHalf && (shouldReverseTopSide || shouldReverseBottomSide)) {
                        position = this._adjustPos(position, false, 'expand', shouldReverseTopSide ? 'Bottom' : 'Top');
                    }
                    break;
                case 'rightTop':
                    if (shouldReverseRight) {
                        position = this._adjustPos(position);
                    }
                    if (shouldReverseTopSide && heightIsBigger) {
                        position = this._adjustPos(position, true);
                    }
                    if (isHeightOverFlow && (isViewYEnoughSideHalf || isContainerYEnoughSideHalf)) {
                        position = this._adjustPos(position, false, 'reduce');
                    }
                    break;
                case 'rightBottom':
                    if (shouldReverseRight) {
                        position = this._adjustPos(position);
                    }
                    if (shouldReverseBottomSide && heightIsBigger) {
                        position = this._adjustPos(position, true);
                    }
                    if (isHeightOverFlow && (isViewYEnoughSideHalf || isContainerYEnoughSideHalf)) {
                        position = this._adjustPos(position, false, 'reduce');
                    }
                    break;
                case 'leftTopOver':
                    if (shouldReverseTopOver) {
                        position = this._adjustPos(position, true);
                    }
                    if (shouldReverseLeftOver) {
                        position = this._adjustPos(position);
                    }
                    break;
                case 'leftBottomOver':
                    if (shouldReverseBottomOver) {
                        position = this._adjustPos(position, true);
                    }
                    if (shouldReverseLeftOver) {
                        position = this._adjustPos(position);
                    }
                    break;
                case 'rightTopOver':
                    if (shouldReverseTopOver) {
                        position = this._adjustPos(position, true);
                    }
                    if (shouldReverseRightOver) {
                        position = this._adjustPos(position);
                    }
                    break;
                case 'rightBottomOver':
                    if (shouldReverseBottomOver) {
                        position = this._adjustPos(position, true);
                    }
                    if (shouldReverseRightOver) {
                        position = this._adjustPos(position);
                    }
                    break;
                default:
                    break;
            }

            // 判断溢出 Judgment overflow
            // 上下方向 top and bottom
            if (this.isTB(position)) {
                isHeightOverFlow = isViewYOverFlow && isContainerYOverFlow;
                // Related PR: https://github.com/DouyinFE/semi-design/pull/1297
                // If clientRight or restClientRight less than 0, means that the left and right parts of the trigger are blocked
                // Then the display of the wrapper will also be affected, make width overflow to offset the wrapper
                if (position === 'top' || position === 'bottom') {
                    isWidthOverFlow = isViewXOverFlowSideHalf && isContainerXOverFlowSideHalf || (clientRight < 0 || restClientRight < 0);
                } else {
                    isWidthOverFlow = isViewXOverFlowSide && isContainerXOverFlowSide || (clientRight < 0 || restClientRight < 0);
                }
            }
            // 左右方向 left and right
            if (this.isLR(position)) {
                isWidthOverFlow = isViewXOverFlow && isContainerXOverFlow;
                // If clientTop or restClientTop less than 0, means that the top and bottom parts of the trigger are blocked
                // Then the display of the wrapper will also be affected, make height overflow to offset the wrapper
                if (position === 'left' || position === 'right') {
                    isHeightOverFlow = isViewYOverFlowSideHalf && isContainerYOverFlowSideHalf || (clientTop < 0 || restClientTop < 0);
                } else {
                    isHeightOverFlow = isViewYOverFlowSide && isContainerYOverFlowSide || (clientTop < 0 || restClientTop < 0);
                }
            }
        }

        return { position, isHeightOverFlow, isWidthOverFlow };
    }

    delayHide = () => {
        const mouseLeaveDelay = this.getProp('mouseLeaveDelay');

        this.clearDelayTimer();

        if (mouseLeaveDelay > 0) {
            this._timer = setTimeout(() => {
                // console.log('delayHide for ', mouseLeaveDelay, ' ms, ', ...args);
                this.hide();
                this.clearDelayTimer();
            }, mouseLeaveDelay);
        } else {
            this.hide();
        }
    };

    hide = () => {
        this.clearDelayTimer();

        this._togglePortalVisible(false);

        this._adapter.off('portalInserted');
        this._adapter.off('positionUpdated');

    };

    _bindScrollEvent() {
        this._adapter.registerScrollHandler(() => this.calcPosition());
        // Capture scroll events on the window to determine whether the current scrolling area (e.target) will affect the positioning of the pop-up layer relative to the viewport when scrolling
        // (By determining whether the e.target contains the triggerDom of the current tooltip) If so, the pop-up layer will also be affected and needs to be repositioned
    }

    unBindScrollEvent() {
        this._adapter.unregisterScrollHandler();
    }

    _initContainerPosition() {
        if (this._adapter.getContainerPosition() || !this._adapter.containerIsBody()) {
            return;
        }
        this._adapter.updateContainerPosition();
    }

    handleContainerKeydown = (event: any) => {
        const { guardFocus, closeOnEsc } = this.getProps();
        switch (event && event.key) {
            case "Escape":
                closeOnEsc && this._handleEscKeyDown(event);
                break;
            case "Tab":
                if (guardFocus) {
                    const container = this._adapter.getContainer();
                    const focusableElements = this._adapter.getFocusableElements(container);
                    const focusableNum = focusableElements.length;
    
                    if (focusableNum) {
                        // Shift + Tab will move focus backward
                        if (event.shiftKey) {
                            this._handleContainerShiftTabKeyDown(focusableElements, event);
                        } else {
                            this._handleContainerTabKeyDown(focusableElements, event);
                        }
                    }
                }
                break;
            default:
                break;
        }
    }

    _handleTriggerKeydown(event: any) {
        const { closeOnEsc, disableArrowKeyDown } = this.getProps();
        const container = this._adapter.getContainer();
        const focusableElements = this._adapter.getFocusableElements(container);
        const focusableNum = focusableElements.length;
        
        switch (event && event.key) {
            case "Escape":
                handlePrevent(event);
                closeOnEsc && this._handleEscKeyDown(event);
                break;
            case "ArrowUp":
                // when disableArrowKeyDown is true, disable tooltip's arrow keyboard event action
                !disableArrowKeyDown && focusableNum && this._handleTriggerArrowUpKeydown(focusableElements, event);
                break;
            case "ArrowDown":
                !disableArrowKeyDown && focusableNum && this._handleTriggerArrowDownKeydown(focusableElements, event);
                break;
            default:
                break;
        }
    }

    /**
     * focus trigger 
     * 
     * when trigger is 'focus' or 'hover', onFocus is bind to show popup
     * if we focus trigger, popup will show again
     * 
     * 如果 trigger 是 focus 或者 hover，则它绑定了 onFocus，这里我们如果重新 focus 的话，popup 会再次打开
     * 因此 returnFocusOnClose 只支持 click trigger
     */
    focusTrigger() {
        const { trigger, returnFocusOnClose, preventScroll } = this.getProps();
        if (returnFocusOnClose && trigger !== 'custom') {
            const triggerNode = this._adapter.getTriggerNode();
            if (triggerNode && 'focus' in triggerNode) {
                triggerNode.focus({ preventScroll });
            }
        }
    }

    _handleEscKeyDown(event: any) {
        const { trigger } = this.getProps();
        if (trigger !== 'custom') {
            // Move the focus into the trigger first and then close the pop-up layer 
            // to avoid the problem of opening the pop-up layer again when the focus returns to the trigger in the case of hover and focus
            this.focusTrigger();
            this.hide();
        }
        this._adapter.notifyEscKeydown(event);
    }

    _handleContainerTabKeyDown(focusableElements: any[], event: any) {
        const { preventScroll } = this.getProps();
        const activeElement = this._adapter.getActiveElement();
        const isLastCurrentFocus = focusableElements[focusableElements.length - 1] === activeElement;
        if (isLastCurrentFocus) {
            focusableElements[0].focus({ preventScroll });
            event.preventDefault(); // prevent browser default tab move behavior
        }
    }

    _handleContainerShiftTabKeyDown(focusableElements: any[], event: any) {
        const { preventScroll } = this.getProps();
        const activeElement = this._adapter.getActiveElement();
        const isFirstCurrentFocus = focusableElements[0] === activeElement;
        if (isFirstCurrentFocus) {
            focusableElements[focusableElements.length - 1].focus({ preventScroll });
            event.preventDefault(); // prevent browser default tab move behavior
        }
    }

    _handleTriggerArrowDownKeydown(focusableElements: any[], event: any) {
        const { preventScroll } = this.getProps();
        focusableElements[0].focus({ preventScroll });
        event.preventDefault(); // prevent browser default scroll behavior
    }

    _handleTriggerArrowUpKeydown(focusableElements: any[], event: any) {
        const { preventScroll } = this.getProps();
        focusableElements[focusableElements.length - 1].focus({ preventScroll });
        event.preventDefault(); // prevent browser default scroll behavior
    }
}
