import React, { createRef, ReactNode, RefObject } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { ResizeGroupFoundation, ResizeGroupAdapter } from '@douyinfe/semi-foundation/resizable/foundation';
import { cssClasses } from '@douyinfe/semi-foundation/resizable/constants';
import BaseComponent from '../../_base/baseComponent';
import { ResizeContext, ResizeContextProps } from './resizeContext';
import { ResizeCallback, ResizeEventType, ResizeStartCallback } from '@douyinfe/semi-foundation/resizable/types';
import "@douyinfe/semi-foundation/resizable/resizable.scss";

const prefixCls = cssClasses.PREFIX;

export interface ResizeGroupProps {
    children: ReactNode;
    direction: 'horizontal' | 'vertical';
    className?: string
}

export interface ResizeGroupState {
    isResizing: boolean;
    originalPosition: {
        x: number;
        y: number;
        lastItemSize: number;
        nextItemSize: number;
        lastOffset: number;
        nextOffset: number
    };
    backgroundStyle: React.CSSProperties;
    curHandler: number;
    contextValue: ResizeContextProps
}

class ResizeGroup extends BaseComponent<ResizeGroupProps, ResizeGroupState> {

    static propTypes = {
    };

    static defaultProps: Partial<ResizeGroupProps> = {
        direction: 'horizontal'
    };

    constructor(props: ResizeGroupProps) {
        super(props);
        this.groupRef = createRef();
        this.foundation = new ResizeGroupFoundation(this.adapter);
        this.state = {
            isResizing: false,
            originalPosition: {
                x: 0,
                y: 0,
                lastItemSize: 0,
                nextItemSize: 0,
                lastOffset: 0,
                nextOffset: 0,
            },
            backgroundStyle: {
                cursor: 'auto',
            },
            curHandler: null,
            contextValue: {
                direction: props.direction,
                registerItem: this.registerItem,
                registerHandler: this.registerHandler,
                notifyResizeStart: this.foundation.onResizeStart,
                getGroupSize: this.getGroupSize,
            },
        };
    }

    foundation: ResizeGroupFoundation;
    groupRef: React.RefObject<HTMLDivElement>;
    groupSize: number;
    availableSize: number;
    static contextType = ResizeContext;
    context: ResizeGroupProps;
    // 在context中使用的属性需要考虑在strictMode下会执行两次，所以用Map来维护
    itemRefs: Map<number, RefObject<HTMLDivElement>> = new Map();
    itemMinMap: Map<number, string> = new Map();
    itemMaxMap: Map<number, string> = new Map();
    itemMinusMap: Map<number, number> = new Map();
    itemDefaultSizeList: Map<number, (string|number)> = new Map();
    itemResizeStart: Map<number, ResizeStartCallback> = new Map();
    itemResizing: Map<number, ResizeCallback> = new Map();
    itemResizeEnd: Map<number, ResizeCallback> = new Map();
    handlerRefs: Map<number, RefObject<HTMLDivElement>> = new Map();

    componentDidMount() {
        this.foundation.init();
        // 监听窗口大小变化，保证一些限制仍生效
        window.addEventListener('resize', this.foundation.ensureConstraint);
    }

    componentDidUpdate(prevProps: ResizeGroupProps) {
        // 支持动态调整伸缩direction
        if (this.props.direction !== prevProps.direction) {
            this.setState((prevState) => ({
                ...prevState, // 保留其他状态
                contextValue: {
                    ...prevState.contextValue, // 保留其他上下文值
                    direction: this.props.direction,
                }
            }));
            this.foundation.direction = this.props.direction;
        }
    }

    componentWillUnmount() {
        this.foundation.destroy();
        window.removeEventListener('resize', this.foundation.ensureConstraint);
    }

    get adapter(): ResizeGroupAdapter<ResizeGroupProps, ResizeGroupState> {
        return {
            ...super.adapter,
            getGroupRef: () => this.groupRef.current,
            getItem: (id: number) => this.itemRefs.get(id).current,
            getItemCount: () => this.itemRefs.size,
            getHandler: (id: number) => this.handlerRefs.get(id).current,
            getHandlerCount: () => this.handlerRefs.size,
            getItemMin: (index) => {
                return this.itemMinMap.get(index);
            },
            getItemMax: (index) => {
                return this.itemMaxMap.get(index);
            },
            getItemChange: (index) => {
                return this.itemResizing.get(index);
            },
            getItemEnd: (index) => {
                return this.itemResizeEnd.get(index);   
            },
            getItemStart: (index) => {
                return this.itemResizeStart.get(index);
            },
            getItemDefaultSize: (index) => {
                return this.itemDefaultSizeList.get(index);
            },
            registerEvents: this.registerEvent,
            unregisterEvents: this.unregisterEvent,
        };
    }

    get window(): Window | null {
        return this.groupRef.current.ownerDocument.defaultView as Window ?? null;
    }

    registerEvent = (type: ResizeEventType = 'mouse') => {
        if (this.window) {
            if (type === 'mouse') {
                this.window.addEventListener('mousemove', this.foundation.onMouseMove);
                this.window.addEventListener('mouseup', this.foundation.onResizeEnd);
                this.window.addEventListener('mouseleave', this.foundation.onResizeEnd);
            } else {
                this.window.addEventListener('touchmove', this.foundation.onTouchMove, { passive: false });
                this.window.addEventListener('touchend', this.foundation.onResizeEnd);
                this.window.addEventListener('touchcancel', this.foundation.onResizeEnd);
            } 
        }
    }

    unregisterEvent = (type: ResizeEventType = 'mouse') => {
        if (this.window) {
            if (type === 'mouse') {
                this.window.removeEventListener('mousemove', this.foundation.onMouseMove);
                this.window.removeEventListener('mouseup', this.foundation.onResizeEnd);
                this.window.removeEventListener('mouseleave', this.foundation.onResizeEnd);
            } else {
                this.window.removeEventListener('touchmove', this.foundation.onTouchMove, { passive: false } as any);
                this.window.removeEventListener('touchend', this.foundation.onResizeEnd);
                this.window.removeEventListener('touchcancel', this.foundation.onResizeEnd);
            }
        }
    }

    registerItem = (ref: RefObject<HTMLDivElement>,
        min: string, max: string, defaultSize: string|number,
        onResizeStart: ResizeStartCallback, onChange: ResizeCallback, onResizeEnd: ResizeCallback
    ) => {
        if (Array.from(this.itemRefs.values()).some(r => r === ref)) {
            return -1;
        }
        let index = this.itemRefs.size;
        this.itemRefs.set(index, ref);
        this.itemMinMap.set(index, min);
        this.itemMaxMap.set(index, max);
        this.itemDefaultSizeList.set(index, defaultSize);
        this.itemResizeStart.set(index, onResizeStart);
        this.itemResizing.set(index, onChange);
        this.itemResizeEnd.set(index, onResizeEnd);
        return index;
    }

    registerHandler = (ref: RefObject<HTMLDivElement>) => {
        if (Array.from(this.handlerRefs.values()).some(r => r === ref)) {
            return -1;
        }
        let index = this.handlerRefs.size;
        this.handlerRefs.set(index, ref);
        return index;
    }

    getGroupSize = () => {
        return this.groupSize;
    }

    render() {
        const { children, direction, className, ...rest } = this.props;
        return (
            <ResizeContext.Provider value={this.state.contextValue}>
                <div
                    style={{
                        flexDirection: direction === 'vertical' ? 'column' : 'row',
                    }}
                    ref={this.groupRef}
                    className={classNames(className, prefixCls + '-group')}
                    {...rest}
                >
                    {this.state.isResizing && <div style={this.state.backgroundStyle} className={classNames(className, prefixCls + '-background')}/>}
                    {children}
                </div>
            </ResizeContext.Provider>
        );
    }
}

export default ResizeGroup;
