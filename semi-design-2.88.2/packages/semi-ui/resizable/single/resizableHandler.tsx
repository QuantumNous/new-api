import React, { createRef, ReactNode } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { ResizableHandlerFoundation, ResizableHandlerAdapter } from '@douyinfe/semi-foundation/resizable/foundation';

import { cssClasses } from '@douyinfe/semi-foundation/resizable/constants';
import { Direction, HandlerCallback } from '@douyinfe/semi-foundation/resizable/types';
import BaseComponent from '../../_base/baseComponent';

const prefixCls = cssClasses.PREFIX;

export interface ResizableHandlerProps {
    children?: ReactNode;
    direction?: Direction;
    onResizeStart?: HandlerCallback;
    className?: string;
    disabled?: boolean;
    style?: React.CSSProperties
}

export interface ResizableHandlerState {
    direction: Direction
}

class ResizableHandler extends BaseComponent<ResizableHandlerProps, ResizableHandlerState> {
    static propTypes = {
        children: PropTypes.node,
        direction: PropTypes.string,
        onResizeStart: PropTypes.func,
        className: PropTypes.string,
        disabled: PropTypes.bool,
        style: PropTypes.object,
    };

    static defaultProps: Partial<ResizableHandlerProps> = {
    };

    constructor(props: ResizableHandlerProps) {
        super(props);
        this.state = {
            direction: this.props.direction
        };
        this.resizeHandlerRef = createRef();
        this.foundation = new ResizableHandlerFoundation(this.adapter); 
    }

    componentDidMount() {
        this.foundation.init();
    }

    componentDidUpdate(_prevProps: ResizableHandlerProps) {
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    foundation: ResizableHandlerFoundation;

    get adapter(): ResizableHandlerAdapter<ResizableHandlerProps, ResizableHandlerState> {
        return {
            ...super.adapter,
            registerEvent: () => {
                this.resizeHandlerRef.current.addEventListener('mousedown', this.foundation.onMouseDown);
                this.resizeHandlerRef.current.addEventListener('touchstart', this.foundation.onTouchStart);
            },
            unregisterEvent: () => {
                this.resizeHandlerRef.current.removeEventListener('mousedown', this.foundation.onMouseDown);
                this.resizeHandlerRef.current.removeEventListener('touchstart', this.foundation.onTouchStart);
            },
        };
    }

    resizeHandlerRef: React.RefObject<HTMLDivElement>
    render() {
        const { children, style, className } = this.props;
        return (
            <div 
                className={classNames(className, prefixCls + '-resizableHandler', prefixCls + '-resizableHandler-' + this.props.direction)}
                style={{
                    ...style
                }} 
                ref={this.resizeHandlerRef}
            >
                { children }
            </div>
        ); 
    }
}

export default ResizableHandler;
