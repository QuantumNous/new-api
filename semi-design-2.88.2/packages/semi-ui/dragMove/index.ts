import DragMoveFoundation, { DragMoveAdapter } from '@douyinfe/semi-foundation/dragMove/foundation';
import BaseComponent from '../_base/baseComponent';
import { ReactNode } from 'react';
import PropTypes from 'prop-types';
import React from 'react';
import { isHTMLElement } from '../_base/reactUtils';
import ReactDOM from 'react-dom';

export interface DragMoveProps {
    // The element that triggers the drag event，default is element
    handler?: () => ReactNode;
    // The element that constrains the movement range, This element requires relative positioning
    constrainer?: () => ReactNode | 'parent';
    children?: ReactNode | undefined | any;
    onMouseDown?: (e: MouseEvent) => void;
    onMouseMove?: (e: MouseEvent) => void;
    onMouseUp?: (e: MouseEvent) => void;
    onTouchStart?: (e: TouchEvent) => void;
    onTouchMove?: (e: TouchEvent) => void;
    onTouchEnd?: (e: TouchEvent) => void;
    onTouchCancel?: (e: TouchEvent) => void;
    // Determine whether dragging is triggered when the mouse is pressed. 
    // Return true to trigger dragging. Return false to not trigger dragging.
    allowMove?: (e: MouseEvent | TouchEvent, element: HTMLElement) => boolean;
    // customize move behavior
    customMove?: (e: HTMLElement, top: number, left: number) => void
}

export default class DragMove extends BaseComponent<DragMoveProps, null> {
    
    static propTypes = {
        children: PropTypes.node,
        handler: PropTypes.func,
        allowInputDrag: PropTypes.bool,
        constrainNode: PropTypes.func,
        onMouseDown: PropTypes.func,
        onMouseMove: PropTypes.func,
        onMouseUp: PropTypes.func,
        onTouchStart: PropTypes.func,
        onTouchMove: PropTypes.func,
        onTouchEnd: PropTypes.func,
        onTouchCancel: PropTypes.func,
    }

    static __SemiComponentName__ = "DragMove";

    static defaultProps = {
        allowInputDrag: false,
    };

    constructor(props: DragMoveProps) {
        super(props);
        this.elementRef = React.createRef();
        this.foundation = new DragMoveFoundation(this.adapter);
    }

    elementRef: React.RefObject<unknown>;
    foundation: DragMoveFoundation;

    get adapter(): DragMoveAdapter<DragMoveProps, null> {
        return {
            ...super.adapter,
            getDragElement: () => {
                let elementDom = this.elementRef.current;
                if (!isHTMLElement(elementDom)) {
                    /* REACT_18_START */
                    elementDom = ReactDOM.findDOMNode(elementDom as React.ReactInstance);
                    /* REACT_18_END */
                    /* REACT_19_START */
                    // console.warn(`[Semi DragMove] elementDom should be a valid DOM element. The element's ref is not returning a DOM node. This may cause dragMove positioning issues. Please ensure the element has a proper ref that returns a DOM node.`);
                    /* REACT_19_END */
                }
                return elementDom as HTMLElement;
            },
            getConstrainer: () => {
                const { constrainer } = this.props;
                if (typeof constrainer === 'string' && constrainer === 'parent') {
                    return (this.elementRef.current as HTMLElement)?.parentNode as HTMLElement;
                } else if (typeof constrainer === 'function') {
                    return constrainer() as any;
                } else {
                    return null;
                }
            },
            getHandler: () => {
                const { handler } = this.props;
                if (typeof handler === 'function') {
                    return handler() as any;
                } else {
                    return this.adapter.getDragElement() as HTMLElement;
                }
            },
            notifyMouseDown: (e: MouseEvent) => {
                this.props.onMouseDown && this.props.onMouseDown(e);
            },
            notifyMouseMove: (e: MouseEvent) => {
                this.props.onMouseMove && this.props.onMouseMove(e);
            },
            notifyMouseUp: (e: MouseEvent) => {
                this.props.onMouseUp && this.props.onMouseUp(e);
            },
            notifyTouchStart: (e: TouchEvent) => {
                this.props.onTouchStart && this.props.onTouchStart(e);
            },
            notifyTouchMove: (e: TouchEvent) => {
                this.props.onTouchMove && this.props.onTouchMove(e);
            },
            notifyTouchEnd: (e: TouchEvent) => {
                this.props.onTouchEnd && this.props.onTouchEnd(e);
            },
            notifyTouchCancel: (e: TouchEvent) => {
                this.props.onTouchCancel && this.props.onTouchCancel(e);
            },
        };
    }

    componentDidMount(): void {
        this.foundation.init();
    }

    componentWillUnmount(): void {
        this.foundation.destroy();
    }

    render() {
        const { children } = this.props;
        const newChildren = React.cloneElement(children, {
            ref: (node: React.ReactNode) => {
                (this.elementRef as any).current = node;
                // Call the original ref, if any
                /* REACT_18_START */
                const { ref } = children as any;
                /* REACT_18_END */
                /* REACT_19_START */
                // const { ref } = (children as any).props;
                /* REACT_19_END */
                if (typeof ref === 'function') {
                    ref(node);
                } else if (ref && typeof ref === 'object') {
                    ref.current = node;
                }
            },
        });
        return newChildren;
    }
}
 