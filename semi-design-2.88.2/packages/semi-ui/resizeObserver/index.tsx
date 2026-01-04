import React from 'react';
import { findDOMNode } from 'react-dom';
import PropTypes from 'prop-types';
import BaseComponent, { BaseProps } from '../_base/baseComponent';

/** A parallel type to `ResizeObserverEntry` (from resize-observer-polyfill). */
export interface ResizeEntry {
    contentRect: DOMRectReadOnly;
    target: Element
}

export interface ReactResizeObserverProps extends BaseProps {
    onResize?: (entries: ResizeEntry[]) => void;
    observeParent?: boolean;
    observerProperty?: ObserverProperty;
    delayTick?: number
}


export enum ObserverProperty {
    Width='width',
    Height = "height",
    All = "all"
}
export default class ReactResizeObserver extends BaseComponent<ReactResizeObserverProps> {
    static propTypes = {
        onResize: PropTypes.func,
        observeParent: PropTypes.bool,
        observerProperty: PropTypes.string,
        delayTick: PropTypes.number
    };

    static defaultProps = {
        onResize: () => {}, // eslint-disable-line
        observeParent: false,
        observerProperty: "all",
        delayTick: 0
    };
    observer: ResizeObserver;
    childNode: any;
    element: Element;
    _parentNode: HTMLElement;

    formerPropertyValue: Map<Element, number> = new Map()


    constructor(props: ReactResizeObserverProps) {
        super(props);
        if (globalThis['ResizeObserver']) {
            this.observer = new ResizeObserver(this.handleResizeEventTriggered);
        }
    }

    componentDidMount() {
        this.observeElement?.();
    }

    componentDidUpdate(prevProps: ReactResizeObserverProps) {
        this.observeElement?.(this.props.observeParent !== prevProps.observeParent);
    }

    componentWillUnmount() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
            this.element = null;
        }
    }

    getElement = () => {
        try {
            // using findDOMNode for two reasons:
            // 1. cloning to insert a ref is unwieldy and not performant.
            // 2. ensure that we resolve to an actual DOM node (instead of any JSX ref instance).
            
            /* REACT_18_START */
            return findDOMNode(this.childNode || this);
            /* REACT_18_END */
            /* REACT_19_START */
            // return this.childNode || null;
            /* REACT_19_END */
        } catch (error) {
            // swallow error if findDOMNode is run on unmounted component.
            return null;
        }
    };


    handleResizeEventTriggered = (entries: ResizeEntry[]) => {
        if (this.props.observerProperty === ObserverProperty.All) {
            this.props.onResize?.(entries);
        } else {
            const finalEntries: ResizeEntry[] = [];
            for (const entry of entries) {
                if (this.formerPropertyValue.has(entry.target)) {
                    if (entry.contentRect[this.props.observerProperty] !== this.formerPropertyValue.get(entry.target)) {
                        this.formerPropertyValue.set(entry.target, entry.contentRect[this.props.observerProperty]);
                        finalEntries.push(entry);
                    }
                } else {
                    this.formerPropertyValue.set(entry.target, entry.contentRect[this.props.observerProperty]);
                    finalEntries.push(entry);
                }
            }
            if (finalEntries.length > 0) {
                this.props.onResize?.(finalEntries);
            }
        }
    }

    observeElement = (force = false) => {
        const element = this.getElement();
        if (!this.observer) {
            this.observer = new ResizeObserver(this.handleResizeEventTriggered);
        }
        if (!(element && element instanceof Element)) {
            // stop everything if not defined
            this.observer.disconnect();
            return;
        }

        if (element === this.element && !force) {
            // abort if given same element -- nothing to update (unless forced)
            return;
        } else {
            // clear observer list if new element
            this.observer.disconnect();
            // remember element reference for next time
            this.element = element;
        }

        // observer callback is invoked immediately when observing new elements
        this.observer.observe(element);

        if (
            this.props.observeParent &&
            element.parentNode &&
            element.parentNode.ownerDocument &&
            element.parentNode.ownerDocument.defaultView &&
            element.parentNode instanceof element.parentNode.ownerDocument.defaultView.HTMLElement
        ) {
            this._parentNode = element.parentNode;
            this.observer.observe(this._parentNode);
        }
    }

    mergeRef = (ref: any, node: HTMLDivElement) => {
        this.childNode = node;
        if (typeof ref === 'function') {
            ref(node);
        } else if (typeof ref === 'object' && ref && 'current' in ref) {
            ref.current = node;
        }
    };

    render() {
        const child = React.Children.only(this.props.children);
        /* REACT_18_START */
        const { ref } = child as any;
        /* REACT_18_END */
        /* REACT_19_START */
        // const { ref } = (child as any).props;
        /* REACT_19_END */
        return React.cloneElement(child as React.ReactElement<any>, {
            ref: (node: HTMLDivElement) => this.mergeRef(ref, node),
        });
    }
}
