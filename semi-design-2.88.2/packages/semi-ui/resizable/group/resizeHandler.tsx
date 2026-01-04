import React, { Children, createRef, ReactNode, useContext } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { ResizeHandlerFoundation, ResizeHandlerAdapter } from '@douyinfe/semi-foundation/resizable/foundation';
import { cssClasses } from '@douyinfe/semi-foundation/resizable/constants';
import { Direction, HandlerCallback } from '@douyinfe/semi-foundation/resizable/types';
import BaseComponent from '../../_base/baseComponent';
import { ResizeContext, ResizeContextProps } from './resizeContext';
import { IconHandle } from '@douyinfe/semi-icons';


const prefixCls = cssClasses.PREFIX;

export interface ResizeHandlerProps {
    children?: ReactNode;
    direction?: Direction;
    onResizeStart?: HandlerCallback;
    className?: string;
    disabled?: boolean;
    style?: React.CSSProperties
}

export interface ResizeHandlerState {
}

class ResizeHandler extends BaseComponent<ResizeHandlerProps, ResizeHandlerState> {
    static propTypes = {
        children: PropTypes.node,
        direction: PropTypes.string,
        onResizeStart: PropTypes.func,
        className: PropTypes.string,
        disabled: PropTypes.bool,
        style: PropTypes.object,
    };

    static defaultProps: Partial<ResizeHandlerProps> = {
    };

    constructor(props: ResizeHandlerProps) {
        super(props);
        this.state = {
        };
        this.handlerRef = createRef();
        this.foundation = new ResizeHandlerFoundation(this.adapter);
        this.handlerIndex = -1;
    }

    componentDidMount() {
        this.foundation.init();
        if (this.handlerIndex === -1) {
            this.handlerIndex = this.context.registerHandler(this.handlerRef);
        }
    }

    componentDidUpdate(_prevProps: ResizeHandlerProps) {
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    foundation: ResizeHandlerFoundation;
    onMouseDown = (e: MouseEvent) => {
        const { notifyResizeStart } = this.context;
        notifyResizeStart(this.handlerIndex, e, 'mouse');
    }

    onTouchStart = (e: TouchEvent) => {
        const { notifyResizeStart } = this.context;
        notifyResizeStart(this.handlerIndex, e.targetTouches[0], 'touch');
    }
    
    get adapter(): ResizeHandlerAdapter<ResizeHandlerProps, ResizeHandlerState> {
        return {
            ...super.adapter,
            registerEvents: () => {
                this.handlerRef.current.addEventListener('mousedown', this.onMouseDown);
                this.handlerRef.current.addEventListener('touchstart', this.onTouchStart);
            },
            unregisterEvents: () => {
                this.handlerRef.current.removeEventListener('mousedown', this.onMouseDown);
                this.handlerRef.current.removeEventListener('touchstart', this.onTouchStart);
            },
        };
    }

    getHandler: () => HTMLElement = () => {
        return this.handlerRef.current;
    }

    static contextType = ResizeContext;
    context: ResizeContextProps;
    handlerRef: React.RefObject<HTMLDivElement>
    handlerIndex: number;

    render() {
        const { style, className, children } = this.props;
        const { direction } = this.context;
        return (
            <div
                className={classNames(className, prefixCls + '-handler', prefixCls + '-handler-' + direction)}
                style={style}
                ref={this.handlerRef}
            >
                {children ?? <IconHandle size='inherit' style={{
                    rotate: this.context.direction === 'horizontal' ? '0deg' : '90deg',
                }}/>}
            </div>
        );
    }
}

export default ResizeHandler;
