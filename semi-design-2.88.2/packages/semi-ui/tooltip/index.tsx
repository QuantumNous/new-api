import React, { isValidElement, cloneElement, CSSProperties, ReactInstance } from 'react';
import ReactDOM, { findDOMNode } from 'react-dom';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { throttle, noop, get, omit, each, isEmpty, isFunction, isEqual } from 'lodash';

import { BASE_CLASS_PREFIX } from '@douyinfe/semi-foundation/base/constants';
import warning from '@douyinfe/semi-foundation/utils/warning';
import Event from '@douyinfe/semi-foundation/utils/Event';
import { ArrayElement } from '@douyinfe/semi-foundation/utils/type';
import { convertDOMRectToObject, DOMRectLikeType } from '@douyinfe/semi-foundation/utils/dom';
import TooltipFoundation, {
    TooltipAdapter,
    Position,
    PopupContainerDOMRect
} from '@douyinfe/semi-foundation/tooltip/foundation';
import { strings, cssClasses, numbers } from '@douyinfe/semi-foundation/tooltip/constants';
import { getUuidShort } from '@douyinfe/semi-foundation/utils/uuid';
import '@douyinfe/semi-foundation/tooltip/tooltip.scss';

import BaseComponent, { BaseProps } from '../_base/baseComponent';
import { isHTMLElement } from '../_base/reactUtils';
import {
    getActiveElement,
    getDefaultPropsFromGlobalConfig,
    getFocusableElements,
    runAfterTicks,
    stopPropagation,
} from '../_utils';
import Portal from '../_portal/index';
import ConfigContext, { ContextValue } from '../configProvider/context';
import TriangleArrow from './TriangleArrow';
import TriangleArrowVertical from './TriangleArrowVertical';
import ArrowBoundingShape from './ArrowBoundingShape';
import CSSAnimation from "../_cssAnimation";

export type Trigger = ArrayElement<typeof strings.TRIGGER_SET>;
export type { Position };

export interface ArrowBounding {
    offsetX?: number;
    offsetY?: number;
    width?: number;
    height?: number
}

export interface RenderContentProps<T = HTMLElement> {
    initialFocusRef?: React.RefObject<T>
}

export type RenderContent<T = HTMLElement> = (props: RenderContentProps<T>) => React.ReactNode;

export interface TooltipProps extends BaseProps {
    children?: React.ReactNode;
    motion?: boolean;
    autoAdjustOverflow?: boolean;
    position?: Position;
    getPopupContainer?: () => HTMLElement;
    mouseEnterDelay?: number;
    mouseLeaveDelay?: number;
    trigger?: Trigger;
    className?: string;
    clickToHide?: boolean;
    visible?: boolean;
    style?: React.CSSProperties;
    content?: React.ReactNode | RenderContent;
    prefixCls?: string;
    onVisibleChange?: (visible: boolean) => void;
    onClickOutSide?: (e: React.MouseEvent) => void;
    spacing?: number | { x: number; y: number };
    margin?: number | { marginLeft: number; marginTop: number; marginRight: number; marginBottom: number };
    showArrow?: boolean | React.ReactNode;
    zIndex?: number;
    rePosKey?: string | number;
    role?: string;
    arrowBounding?: ArrowBounding;
    transformFromCenter?: boolean;
    arrowPointAtCenter?: boolean;
    wrapWhenSpecial?: boolean;
    stopPropagation?: boolean;
    clickTriggerToHide?: boolean;
    wrapperClassName?: string;
    closeOnEsc?: boolean;
    guardFocus?: boolean;
    returnFocusOnClose?: boolean;
    onEscKeyDown?: (e: React.KeyboardEvent) => void;
    disableArrowKeyDown?: boolean;
    wrapperId?: string;
    preventScroll?: boolean;
    disableFocusListener?: boolean;
    afterClose?: () => void;
    keepDOM?: boolean
}

interface TooltipState {
    visible: boolean;
    transitionState: string;
    triggerEventSet: {
        [key: string]: any
    };
    portalEventSet: {
        [key: string]: any
    };
    containerStyle: React.CSSProperties;
    isInsert: boolean;
    placement: Position;
    transitionStyle: Record<string, any>;
    isPositionUpdated: boolean;
    id: string;
    displayNone: boolean
}

const prefix = cssClasses.PREFIX;
const positionSet = strings.POSITION_SET;
const triggerSet = strings.TRIGGER_SET;

const blockDisplays = ['flex', 'block', 'table', 'flow-root', 'grid'];
const defaultGetContainer = () => document.body;
export default class Tooltip extends BaseComponent<TooltipProps, TooltipState> {
    static contextType = ConfigContext;

    static propTypes = {
        children: PropTypes.node,
        motion: PropTypes.bool,
        autoAdjustOverflow: PropTypes.bool,
        position: PropTypes.oneOf(positionSet),
        getPopupContainer: PropTypes.func,
        mouseEnterDelay: PropTypes.number,
        mouseLeaveDelay: PropTypes.number,
        trigger: PropTypes.oneOf(triggerSet).isRequired,
        className: PropTypes.string,
        wrapperClassName: PropTypes.string,
        clickToHide: PropTypes.bool,
        // used with trigger === hover, private
        clickTriggerToHide: PropTypes.bool,
        visible: PropTypes.bool,
        style: PropTypes.object,
        content: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
        prefixCls: PropTypes.string,
        onVisibleChange: PropTypes.func,
        onClickOutSide: PropTypes.func,
        spacing: PropTypes.oneOfType([PropTypes.number, PropTypes.object]),
        margin: PropTypes.oneOfType([PropTypes.number, PropTypes.object]),
        showArrow: PropTypes.oneOfType([PropTypes.bool, PropTypes.node]),
        zIndex: PropTypes.number,
        rePosKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        arrowBounding: ArrowBoundingShape,
        transformFromCenter: PropTypes.bool, // Whether to change from the center of the trigger (for dynamic effects)
        arrowPointAtCenter: PropTypes.bool,
        stopPropagation: PropTypes.bool,
        // private
        role: PropTypes.string,
        wrapWhenSpecial: PropTypes.bool, // when trigger has special status such as "disabled" or "loading", wrap span
        guardFocus: PropTypes.bool,
        returnFocusOnClose: PropTypes.bool,
        preventScroll: PropTypes.bool,
        keepDOM: PropTypes.bool,
    };
    static __SemiComponentName__ = "Tooltip";
    static defaultProps = getDefaultPropsFromGlobalConfig(Tooltip.__SemiComponentName__, {
        arrowBounding: numbers.ARROW_BOUNDING,
        autoAdjustOverflow: true,
        arrowPointAtCenter: true,
        trigger: 'hover',
        transformFromCenter: true,
        position: 'top',
        prefixCls: prefix,
        role: 'tooltip',
        mouseEnterDelay: numbers.MOUSE_ENTER_DELAY,
        mouseLeaveDelay: numbers.MOUSE_LEAVE_DELAY,
        motion: true,
        onVisibleChange: noop,
        onClickOutSide: noop,
        spacing: numbers.SPACING,
        margin: numbers.MARGIN,
        showArrow: true,
        wrapWhenSpecial: true,
        zIndex: numbers.DEFAULT_Z_INDEX,
        closeOnEsc: false,
        guardFocus: false,
        returnFocusOnClose: false,
        onEscKeyDown: noop,
        disableFocusListener: false,
        disableArrowKeyDown: false,
        keepDOM: false
    });

    eventManager: Event;
    triggerEl: React.RefObject<unknown>;
    containerEl: React.RefObject<HTMLDivElement>;
    initialFocusRef: React.RefObject<HTMLElement>;
    clickOutsideHandler: any;
    resizeHandler: any;
    isWrapped: boolean;
    mounted: any;
    scrollHandler: any;
    getPopupContainer: () => HTMLElement;
    containerPosition: string;
    foundation: TooltipFoundation;
    context: ContextValue;
    isAnimating: boolean = false;
    cachedLatestTransitionState: "leave"|"enter" = "enter"  // 先修复了 #2605，但是出现了 #2682，所以我们更新 transitionState 状态的时候，不再通过 return 空 state 来获取尚未应用的 state 而是放在 this 上缓存
    constructor(props: TooltipProps) {
        super(props);
        this.state = {
            visible: false,
            /**
             *
             * Note: The transitionState parameter is equivalent to isInsert
             */
            transitionState: '',
            triggerEventSet: {},
            portalEventSet: {},
            containerStyle: {
                // zIndex: props.zIndex,
            },
            isInsert: false,
            placement: props.position || 'top',
            transitionStyle: {},
            isPositionUpdated: false,
            id: props.wrapperId, // auto generate id, will be used by children.aria-describedby & content.id, improve a11y,
            displayNone: false
        };
        this.foundation = new TooltipFoundation(this.adapter);
        this.eventManager = new Event();
        this.triggerEl = React.createRef();
        this.containerEl = React.createRef();
        this.initialFocusRef = React.createRef();
        this.clickOutsideHandler = null;
        this.resizeHandler = null;
        this.isWrapped = false; // Identifies whether a span element is wrapped
        this.containerPosition = undefined;
    }

    setContainerEl = (node: HTMLDivElement) => (this.containerEl = { current: node });

    get adapter(): TooltipAdapter<TooltipProps, TooltipState> {
        return {
            ...super.adapter,
            // @ts-ignore
            on: (...args: any[]) => this.eventManager.on(...args),
            // @ts-ignore
            off: (...args: any[]) => this.eventManager.off(...args),
            getAnimatingState: () => this.isAnimating,
            insertPortal: (content: TooltipProps['content'], { position, ...containerStyle }: { position: Position }) => {
                this.cachedLatestTransitionState = "enter";
                this.setState(
                    {
                        isInsert: true,
                        transitionState: 'enter',
                        containerStyle: { ...this.state.containerStyle, ...containerStyle },
                    },
                    () => {
                        setTimeout(() => {
                            if ( this.cachedLatestTransitionState === 'enter' ) {
                                this.eventManager.emit('portalInserted');
                            }
                            // waiting child component mounted

                        }, 0);
                    }
                );
            },
            removePortal: () => {
                this.setState({ isInsert: false, isPositionUpdated: false });
            },
            getEventName: () => ({
                mouseEnter: 'onMouseEnter',
                mouseLeave: 'onMouseLeave',
                mouseOut: 'onMouseOut',
                mouseOver: 'onMouseOver',
                click: 'onClick',
                focus: 'onFocus',
                blur: 'onBlur',
                keydown: 'onKeyDown',
                contextMenu: 'onContextMenu',
            }),
            registerTriggerEvent: (triggerEventSet: Record<string, any>) => {
                this.setState({ triggerEventSet });
            },
            registerPortalEvent: (portalEventSet: Record<string, any>) => {
                this.setState({ portalEventSet });
            },
            getTriggerBounding: () => {
                // It may be a React component or an html element
                // There is no guarantee that triggerE l.current can get the real dom, so call findDOMNode to ensure that you can get the real dom
                const triggerDOM = this.adapter.getTriggerNode();
                (this.triggerEl as any).current = triggerDOM;
                return triggerDOM && (triggerDOM as Element).getBoundingClientRect();
            },
            // Gets the outer size of the specified container
            getPopupContainerRect: () => {
                const container = this.getPopupContainer();

                let rect: PopupContainerDOMRect = null;

                if (container && isHTMLElement(container)) {
                    const boundingRect: DOMRectLikeType = convertDOMRectToObject(container.getBoundingClientRect());
                    rect = {
                        ...boundingRect,
                        scrollLeft: container.scrollLeft,
                        scrollTop: container.scrollTop,
                    };
                }

                return rect;
            },
            containerIsBody: () => {
                const container = this.getPopupContainer();

                return container === document.body;
            },
            containerIsRelative: () => {
                const container = this.getPopupContainer();
                const computedStyle = window.getComputedStyle(container);
                return computedStyle.getPropertyValue('position') === 'relative';
            },
            containerIsRelativeOrAbsolute: () => ['relative', 'absolute'].includes(this.containerPosition),
            // Get the size of the pop-up layer
            getWrapperBounding: () => {
                const el = this.containerEl && this.containerEl.current;
                return el && (el as Element).getBoundingClientRect();
            },
            getDocumentElementBounding: () => document.documentElement.getBoundingClientRect(),
            setPosition: ({ position, ...style }: { position: Position }) => {
                this.setState(
                    {
                        containerStyle: { ...this.state.containerStyle, ...style },
                        placement: position,
                        isPositionUpdated: true
                    },
                    () => {
                        this.eventManager.emit('positionUpdated');
                    }
                );
            },
            setDisplayNone: (displayNone: boolean, cb: () => void) => {
                this.setState({ displayNone }, cb);
            },
            updatePlacementAttr: (placement: Position) => {
                this.setState({ placement });
            },
            togglePortalVisible: (visible: boolean, cb: () => void) => {
                const willUpdateStates: Partial<TooltipState> = {};

                willUpdateStates.transitionState = visible ? 'enter' : 'leave';
                willUpdateStates.visible = visible;
                this.cachedLatestTransitionState = willUpdateStates.transitionState as "enter"|"leave";

                this.mounted && this.setState(willUpdateStates as TooltipState, () => {
                    cb();
                });
            },
            registerClickOutsideHandler: (cb: () => void) => {
                if (this.clickOutsideHandler) {
                    this.adapter.unregisterClickOutsideHandler();
                }
                this.clickOutsideHandler = (e: React.MouseEvent): any => {
                    if (!this.mounted) {
                        return false;
                    }
                    let el = this.triggerEl && this.triggerEl.current;
                    let popupEl = (this.containerEl && this.containerEl.current) as HTMLDivElement;

                    /* REACT_18_START */
                    el = ReactDOM.findDOMNode(el as React.ReactInstance);
                    /* REACT_18_END */
                    /* REACT_19_START */
                    // el = el as HTMLElement;
                    /* REACT_19_END */
                    const target = e.target as Element;
                    const path = (e as any).composedPath && (e as any).composedPath() || [target];
                    const isClickTriggerToHide = this.props.clickTriggerToHide ? el && (el as any).contains(target) || path.includes(el) : false;
                    if (
                        el && !(el as any).contains(target) &&
                        popupEl && !(popupEl as any).contains(target) &&
                        !(path.includes(popupEl) || path.includes(el)) ||
                        isClickTriggerToHide
                    ) {
                        this.props.onClickOutSide(e);
                        cb();
                    }
                };
                window.addEventListener('mousedown', this.clickOutsideHandler);
            },
            unregisterClickOutsideHandler: () => {
                if (this.clickOutsideHandler) {
                    window.removeEventListener('mousedown', this.clickOutsideHandler);
                    this.clickOutsideHandler = null;
                }
            },
            registerResizeHandler: (cb: (e: any) => void) => {
                if (this.resizeHandler) {
                    this.adapter.unregisterResizeHandler();
                }
                this.resizeHandler = throttle((e): any => {
                    if (!this.mounted) {
                        return false;
                    }
                    cb(e);
                }, 10);
                window.addEventListener('resize', this.resizeHandler, false);
            },
            unregisterResizeHandler: () => {
                if (this.resizeHandler) {
                    window.removeEventListener('resize', this.resizeHandler, false);
                    this.resizeHandler = null;
                }
            },
            notifyVisibleChange: (visible: boolean) => {
                this.props.onVisibleChange(visible);
            },
            registerScrollHandler: (rePositionCb: (arg: { x: number; y: number }) => void) => {
                if (this.scrollHandler) {
                    this.adapter.unregisterScrollHandler();
                }
                this.scrollHandler = throttle((e): any => {
                    if (!this.mounted) {
                        return false;
                    }
                    const triggerDOM = this.adapter.getTriggerNode();
                    const isRelativeScroll = e.target.contains(triggerDOM);
                    if (isRelativeScroll) {
                        const scrollPos = { x: e.target.scrollLeft, y: e.target.scrollTop };
                        rePositionCb(scrollPos);
                    }
                }, 10); // When it is greater than 16ms, it will be very obvious
                window.addEventListener('scroll', this.scrollHandler, true);
            },
            unregisterScrollHandler: () => {
                if (this.scrollHandler) {
                    window.removeEventListener('scroll', this.scrollHandler, true);
                    this.scrollHandler = null;
                }
            },
            canMotion: () => Boolean(this.props.motion),
            updateContainerPosition: () => {
                const positionInBody = document.body.getAttribute('data-position');
                if (positionInBody) {
                    this.containerPosition = positionInBody;
                    return;
                }
                requestAnimationFrame(() => {
                    const container = this.getPopupContainer();
                    if (container && isHTMLElement(container)) {
                        // getComputedStyle need first parameter is Element type
                        const computedStyle = window.getComputedStyle(container);
                        const position = computedStyle.getPropertyValue('position');
                        document.body.setAttribute('data-position', position);
                        this.containerPosition = position;
                    }
                });
            },
            getContainerPosition: () => this.containerPosition,
            getContainer: () => this.containerEl && this.containerEl.current,
            getTriggerNode: () => {
                let triggerDOM = this.triggerEl.current;
                if (!isHTMLElement(this.triggerEl.current)) {
                    /* REACT_18_START */
                    triggerDOM = ReactDOM.findDOMNode(this.triggerEl.current as React.ReactInstance);
                    /* REACT_18_END */
                    /* REACT_19_START */
                    // console.warn(`[Semi Tooltip] triggerDOM should be a valid DOM element. The trigger element's ref is not returning a DOM node. This may cause tooltip positioning issues. Please ensure the trigger element has a proper ref that returns a DOM node.`);
                    // triggerDOM = this.triggerEl.current;
                    /* REACT_19_END */
                }
                return triggerDOM as Element;
            },
            getFocusableElements: (node: HTMLDivElement) => {
                return getFocusableElements(node);
            },
            getActiveElement: () => {
                return getActiveElement();
            },
            setInitialFocus: () => {
                const { preventScroll } = this.props;
                const focusRefNode = get(this, 'initialFocusRef.current') as HTMLElement;
                if (focusRefNode && 'focus' in focusRefNode) {
                    focusRefNode.focus({ preventScroll });
                }
            },
            notifyEscKeydown: (event: React.KeyboardEvent) => {
                this.props.onEscKeyDown(event);
            },
            setId: () => {
                this.setState({ id: getUuidShort() });
            },
            getTriggerDOM: () => {
                if (this.triggerEl.current) {
                    /* REACT_18_START */
                    return ReactDOM.findDOMNode(this.triggerEl.current as ReactInstance) as HTMLElement;
                    /* REACT_18_END */
                    /* REACT_19_START */
                    // return this.triggerEl.current as HTMLElement;
                    /* REACT_19_END */
                } else {
                    return null;
                }

            }
        };
    }

    componentDidMount() {
        this.mounted = true;
        this.getPopupContainer = this.props.getPopupContainer || this.context.getPopupContainer || defaultGetContainer;
        this.foundation.init();
        runAfterTicks(() => {
            let triggerEle = this.triggerEl.current;
            if (triggerEle) {
                if (!(triggerEle instanceof HTMLElement)) {
                    /* REACT_18_START */
                    triggerEle = findDOMNode(triggerEle as ReactInstance);
                    /* REACT_18_END */
                    /* REACT_19_START */
                    // console.warn(`[Semi Tooltip] triggerEle should be a valid DOM element. The trigger element's ref is not returning a DOM node. This may cause tooltip positioning issues. Please ensure the trigger element has a proper ref that returns a DOM node.`);
                    // triggerEle = triggerEle as HTMLElement;
                    /* REACT_19_END */
                }
            }
            this.foundation.updateStateIfCursorOnTrigger(triggerEle as HTMLElement);
        }, 1);

    }

    componentWillUnmount() {
        this.mounted = false;
        this.foundation.destroy();
    }

    /**
     * focus on tooltip trigger
     */
    public focusTrigger() {
        this.foundation.focusTrigger();
    }

    isSpecial = (elem: React.ReactNode | HTMLElement | any) => {
        if (isHTMLElement(elem)) {
            return Boolean(elem.disabled);
        } else if (isValidElement(elem)) {
            const disabled = get(elem, 'props.disabled');

            if (disabled) {
                return strings.STATUS_DISABLED;
            }

            const loading = get(elem, 'props.loading');

            /* Only judge the loading state of the Button, and no longer judge other components */
            const isButton = !isEmpty(elem)
                && !isEmpty(elem.type)
                && (get(elem, 'type.elementType') === 'Button' || get(elem, 'type.elementType') === 'IconButton');
            if (loading && isButton) {
                return strings.STATUS_LOADING;
            }
        }

        return false;
    };

    // willEnter = () => {
    // this.foundation.calcPosition();
    // this.setState({ visible: true });
    // };

    didLeave = () => {
        if (this.props.keepDOM) {
            this.foundation.setDisplayNone(true);
        } else {
            this.foundation.removePortal();
        }
        this.foundation.unBindEvent();
    };

    /** for transition - end */

    rePosition() {
        return this.foundation.calcPosition();
    }

    componentDidUpdate(prevProps: TooltipProps, prevState: TooltipState) {
        warning(
            this.props.mouseLeaveDelay < this.props.mouseEnterDelay,
            "[Semi Tooltip] 'mouseLeaveDelay' cannot be less than 'mouseEnterDelay', which may cause the dropdown layer to not be hidden."
        );
        if (prevProps.visible !== this.props.visible) {
            if (['hover', 'focus'].includes(this.props.trigger)) {
                this.props.visible ? this.foundation.delayShow() : this.foundation.delayHide();
            } else {
                this.props.visible ? this.foundation.show() : this.foundation.hide();
            }
        }
        if (!isEqual(prevProps.rePosKey, this.props.rePosKey)) {
            this.rePosition();
        }
    }

    renderIcon = () => {
        const { placement } = this.state;
        const { showArrow, prefixCls, style } = this.props;
        let icon = null;
        const triangleCls = classNames([`${prefixCls}-icon-arrow`]);
        const bgColor = get(style, 'backgroundColor');

        const iconComponent = placement?.includes('left') || placement?.includes('right') ?
            <TriangleArrowVertical /> :
            <TriangleArrow />;
        if (showArrow) {
            if (isValidElement(showArrow)) {
                icon = showArrow;
            } else {
                icon = React.cloneElement(iconComponent, {
                    className: triangleCls,
                    style: { color: bgColor, fill: 'currentColor' }
                });
            }
        }

        return icon;
    };

    handlePortalInnerClick = (e: React.MouseEvent) => {
        if (this.props.clickToHide) {
            this.foundation.hide();
        }
        if (this.props.stopPropagation) {
            stopPropagation(e);
        }
    };

    handlePortalMouseDown = (e: React.MouseEvent) => {
        if (this.props.stopPropagation) {
            stopPropagation(e);
        }
    }

    handlePortalFocus = (e: React.FocusEvent<HTMLElement>) => {
        if (this.props.stopPropagation) {
            stopPropagation(e);
        }
    }

    handlePortalBlur = (e: React.FocusEvent<HTMLElement>) => {
        if (this.props.stopPropagation) {
            stopPropagation(e);
        }
    }

    handlePortalInnerKeyDown = (e: React.KeyboardEvent) => {
        this.foundation.handleContainerKeydown(e);
    }

    renderContentNode = (content: TooltipProps['content']) => {
        const contentProps = {
            initialFocusRef: this.initialFocusRef
        };
        return !isFunction(content) ? content : content(contentProps);
    };

    renderPortal = () => {
        const {
            containerStyle = {},
            visible,
            portalEventSet,
            placement,
            displayNone,
            transitionState,
            id,
            isPositionUpdated
        } = this.state;
        const { prefixCls, content, showArrow, style, motion, role, zIndex } = this.props;
        const contentNode = this.renderContentNode(content);
        const { className: propClassName } = this.props;
        const direction = this.context.direction;
        const className = classNames(propClassName, {
            [`${prefixCls}-wrapper`]: true,
            [`${prefixCls}-wrapper-show`]: visible,
            [`${prefixCls}-with-arrow`]: Boolean(showArrow),
            [`${prefixCls}-rtl`]: direction === 'rtl',
        });
        const icon = this.renderIcon();
        const portalInnerStyle = omit(containerStyle, motion ? ['transformOrigin'] : undefined);
        const transformOrigin = get(containerStyle, 'transformOrigin');
        const userOpacity: CSSProperties['opacity'] | null = get(style, 'opacity', null);
        const opacity = userOpacity ? userOpacity : 1;
        const inner =
            <CSSAnimation
                fillMode="forwards"
                animationState={transitionState as "enter" | "leave"}
                motion={motion && isPositionUpdated}
                startClassName={transitionState === 'enter' ? `${prefix}-animation-show` : `${prefix}-animation-hide`}
                onAnimationStart={() => this.isAnimating = true}
                onAnimationEnd={() => {
                    if (transitionState === 'leave') {
                        this.didLeave();
                        this.props.afterClose?.();
                    }
                    this.isAnimating = false;
                }}>
                {
                    ({ animationStyle, animationClassName, animationEventsNeedBind }) => {
                        return <div
                            className={classNames(className, animationClassName)}
                            style={{
                                ...animationStyle,
                                ...(displayNone ? { display: "none" } : {}),
                                transformOrigin,
                                ...style,
                                ...(userOpacity ? { opacity: isPositionUpdated ? opacity : "0" } : {})
                            }}
                            {...portalEventSet}
                            {...animationEventsNeedBind}
                            role={role}
                            x-placement={placement}
                            id={id}
                        >
                            <div className={`${prefix}-content`} >{contentNode}</div>
                            {icon}
                        </div>;
                    }
                }
            </CSSAnimation>;


        return (
            <Portal getPopupContainer={this.props.getPopupContainer} style={{ zIndex }}>
                {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
                <div
                    // listen keyboard event, don't move tabIndex -1
                    tabIndex={-1}
                    className={`${BASE_CLASS_PREFIX}-portal-inner`}
                    style={portalInnerStyle}
                    ref={this.setContainerEl}
                    onClick={this.handlePortalInnerClick}
                    onFocus={this.handlePortalFocus}
                    onBlur={this.handlePortalBlur}
                    onMouseDown={this.handlePortalMouseDown}
                    onKeyDown={this.handlePortalInnerKeyDown}
                >
                    {inner}
                </div>
            </Portal>
        );
    };

    wrapSpan = (elem: React.ReactNode | React.ReactElement<any>) => {
        const { wrapperClassName } = this.props;
        const display = get(elem, 'props.style.display');
        const block = get(elem, 'props.block');
        const isStringElem = typeof elem == 'string';

        const style: React.CSSProperties = {};

        if (!isStringElem) {
            style.display = 'inline-block';
        }

        if (block || blockDisplays.includes(display)) {
            style.width = '100%';
        }

        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        return <span className={wrapperClassName} style={style}>{elem}</span>;
    };

    mergeEvents = (rawEvents: Record<string, any>, events: Record<string, any>) => {
        const mergedEvents = {};
        each(events, (handler: any, key) => {
            if (typeof handler === 'function') {
                mergedEvents[key] = (...args: any[]) => {
                    handler(...args);
                    if (rawEvents && typeof rawEvents[key] === 'function') {
                        rawEvents[key](...args);
                    }
                };
            }
        });

        return mergedEvents;
    };

    getPopupId = () => {
        return this.state.id;
    }

    render() {
        const { isInsert, triggerEventSet, visible, id } = this.state;
        const { wrapWhenSpecial, role, trigger } = this.props;
        let { children } = this.props;
        const childrenStyle = { ...get(children, 'props.style') as React.CSSProperties };
        const extraStyle: React.CSSProperties = {};

        if (wrapWhenSpecial) {
            const isSpecial = this.isSpecial(children);

            if (isSpecial) {
                childrenStyle.pointerEvents = 'none';

                if (isSpecial === strings.STATUS_DISABLED) {
                    extraStyle.cursor = 'not-allowed';
                }

                children = cloneElement(children as React.ReactElement<any>, { style: childrenStyle });
                if (trigger !== 'custom') {
                    // no need to wrap span when trigger is custom, cause it don't need bind event
                    children = this.wrapSpan(children);
                }
                this.isWrapped = true;
            } else if (!isValidElement(children)) {
                children = this.wrapSpan(children);
                this.isWrapped = true;
            }
        }

        let ariaAttribute = {};

        // Take effect when used by Popover component
        if (role === 'dialog') {
            ariaAttribute['aria-expanded'] = visible ? 'true' : 'false';
            ariaAttribute['aria-haspopup'] = 'dialog';
            ariaAttribute['aria-controls'] = id;
        } else {
            ariaAttribute['aria-describedby'] = id;
        }

        // The incoming children is a single valid element, otherwise wrap a layer with span
        const newChild = React.cloneElement(children as React.ReactElement<any>, {
            ...ariaAttribute,
            ...(children as React.ReactElement<any>).props,
            ...this.mergeEvents((children as React.ReactElement<any>).props, triggerEventSet),
            style: {
                ...get(children, 'props.style') as React.CSSProperties,
                ...extraStyle,
            },
            className: classNames(
                get(children, 'props.className')
            ),
            // to maintain refs with callback
            ref: (node: React.ReactNode) => {
                const { tooltipRef } = (children as any).props;
                if (tooltipRef) {
                    // Special for Typography
                    (this.triggerEl as any).current = tooltipRef.current;
                } else {
                    // Keep your own reference
                    (this.triggerEl as any).current = node;
                }
                // Call the original ref, if any
                /* REACT_18_START */
                const { ref } = children as any;
                /* REACT_18_END */
                /* REACT_19_START */
                // const { ref } = (children as any).props;
                /* REACT_19_END */
                // this.log('tooltip render() - get ref', ref);
                if (typeof ref === 'function') {
                    ref(node);
                } else if (ref && typeof ref === 'object') {
                    ref.current = node;
                }
            },
            tabIndex: (children as React.ReactElement<any>).props.tabIndex || 0, // a11y keyboard, in some condition select's tabindex need to -1 or 0
            'data-popupid': id
        });

        // If you do not add a layer of div, in order to bind the events and className in the tooltip, you need to cloneElement children, but this time it may overwrite the children's original ref reference
        // So if the user adds ref to the content, you need to use callback ref: https://github.com/facebook/react/issues/8873
        return (
            <React.Fragment>
                {isInsert ? this.renderPortal() : null}
                {newChild}
            </React.Fragment>
        );
    }
}
