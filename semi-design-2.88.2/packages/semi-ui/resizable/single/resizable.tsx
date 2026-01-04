import React, { createRef, CSSProperties, ReactNode, useRef } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { ResizableFoundation, ResizableAdapter } from '@douyinfe/semi-foundation/resizable/foundation';

import { cssClasses, } from '@douyinfe/semi-foundation/resizable/constants';
import { Direction, Size, Enable, ResizeStartCallback, ResizeCallback, HandleClassName, directions } from '@douyinfe/semi-foundation/resizable/types';
import BaseComponent from '../../_base/baseComponent';
import ResizableHandler from './resizableHandler';
import '@douyinfe/semi-foundation/resizable/resizable.scss';

const prefixCls = cssClasses.PREFIX;
export interface HandleComponent {
    top?: ReactNode;
    right?: ReactNode;
    bottom?: ReactNode;
    left?: ReactNode;
    topRight?: ReactNode;
    bottomRight?: ReactNode;
    bottomLeft?: ReactNode;
    topLeft?: ReactNode
}

export interface HandleStyle {
    top?: CSSProperties;
    right?: CSSProperties;
    bottom?: CSSProperties;
    left?: CSSProperties;
    topRight?: CSSProperties;
    bottomRight?: CSSProperties;
    bottomLeft?: CSSProperties;
    topLeft?: CSSProperties
}

export interface ResizableProps {
    style?: React.CSSProperties;
    className?: string;
    grid?: [number, number];
    snap?: {
        x?: number[];
        y?: number[]
    };
    snapGap?: number;
    boundElement?: 'parent' | 'window' | HTMLElement;
    boundsByDirection?: boolean;
    size?: Size;
    minWidth?: string | number;
    minHeight?: string | number;
    maxWidth?: string | number;
    maxHeight?: string | number;
    lockAspectRatio?: boolean | number;
    lockAspectRatioExtraWidth?: number;
    lockAspectRatioExtraHeight?: number;
    enable?: Enable | false;
    handleStyle?: HandleStyle;
    handleClass?: HandleClassName;
    handleWrapperStyle?: React.CSSProperties;
    handleWrapperClass?: string;
    handleNode?: HandleComponent;
    children?: React.ReactNode;
    onResizeStart?: ResizeStartCallback;
    onChange?: ResizeCallback;
    onResizeEnd?: ResizeCallback;
    defaultSize?: Size;
    scale?: number;
    ratio?: number | [number, number]
}

export interface ResizableState {
    isResizing: boolean;
    direction: Direction;
    original: {
        x: number;
        y: number;
        width: number;
        height: number
    };
    width: number | string;
    height: number | string;

    backgroundStyle: React.CSSProperties;
    flexBasis?: string | number
}

class Resizable extends BaseComponent<ResizableProps, ResizableState> {
    static propTypes = {
        style: PropTypes.object,
        className: PropTypes.string,
        grid: PropTypes.arrayOf(PropTypes.number),
        snap: PropTypes.shape({
            x: PropTypes.arrayOf(PropTypes.number),
            y: PropTypes.arrayOf(PropTypes.number),
        }),        
        snapGap: PropTypes.number,
        bounds: PropTypes.oneOf(['parent', 'window', PropTypes.node]),
        boundsByDirection: PropTypes.bool,
        size: PropTypes.object,
        minWidth: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        minHeight: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        maxWidth: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        maxHeight: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        lockAspectRatio: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
        lockAspectRatioExtraWidth: PropTypes.number,
        lockAspectRatioExtraHeight: PropTypes.number,
        enable: PropTypes.object,
        handleStyle: PropTypes.object,
        handleClass: PropTypes.object,
        handleWrapperStyle: PropTypes.object,
        handleWrapperClass: PropTypes.string,
        handleNode: PropTypes.object,
        children: PropTypes.object,
        onResizeStart: PropTypes.func,
        onChange: PropTypes.func,
        onResizeEnd: PropTypes.func,
        defaultSize: PropTypes.object,
        scale: PropTypes.number,
        ratio: PropTypes.oneOfType([PropTypes.number, PropTypes.arrayOf(PropTypes.number)]),
    };

    static defaultProps: Partial<ResizableProps> = {
        onResizeStart: () => {},
        onChange: () => {},
        onResizeEnd: () => {},
        enable: {
            top: true,
            right: true,
            bottom: true,
            left: true,
            topRight: true,
            bottomRight: true,
            bottomLeft: true,
            topLeft: true,
        },
        style: {},
        grid: [1, 1],
        lockAspectRatio: false,
        lockAspectRatioExtraWidth: 0,
        lockAspectRatioExtraHeight: 0,
        scale: 1,
        ratio: 1,
        snapGap: 0,
    };

    foundation: ResizableFoundation;
    resizableRef: React.RefObject<HTMLDivElement | null>;
    constructor(props: ResizableProps) {
        super(props);
        this.resizableRef = createRef<HTMLDivElement | null>();
        this.foundation = new ResizableFoundation(this.adapter);
        this.state = {
            isResizing: false,
            width: this.foundation.propSize.width ?? 'auto',
            height: this.foundation.propSize.height ?? 'auto',
            direction: 'right',
            original: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
            },
            backgroundStyle: {
                cursor: 'auto',
            },
            flexBasis: undefined,
        };        
    }


    componentDidMount() {
        this.foundation.init();
    }

    componentDidUpdate(_prevProps: ResizableProps) {
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    getResizable = () => {
        return this.resizableRef?.current;
    }

    get adapter(): ResizableAdapter<ResizableProps, ResizableState> {
        return {
            ...super.adapter,
            getResizable: this.getResizable,
            registerEvent: (type = 'mouse') => {
                let window = this.foundation.window;
                if (type === 'mouse') {
                    window?.addEventListener('mouseup', this.foundation.onMouseUp);
                    window?.addEventListener('mousemove', this.foundation.onMouseMove);
                    window?.addEventListener('mouseleave', this.foundation.onMouseUp);
                } else {
                    window?.addEventListener('touchmove', this.foundation.onTouchMove, { passive: false });
                    window?.addEventListener('touchend', this.foundation.onMouseUp);
                    window?.addEventListener('touchcancel', this.foundation.onMouseUp);
                }
            },
            unregisterEvent: (type = 'mouse') => {
                let window = this.foundation.window;
                if (type === 'mouse') {
                    window?.removeEventListener('mouseup', this.foundation.onMouseUp);
                    window?.removeEventListener('mousemove', this.foundation.onMouseMove);
                    window?.removeEventListener('mouseleave', this.foundation.onMouseUp);
                } else {
                    window?.removeEventListener('touchmove', this.foundation.onTouchMove, { passive: false } as any);
                    window?.removeEventListener('touchend', this.foundation.onMouseUp);
                    window?.removeEventListener('touchcancel', this.foundation.onMouseUp);
                }
            },
        };
    }

    renderResizeHandler = () => {
        const { enable, handleStyle, handleClass, handleNode, handleWrapperStyle, handleWrapperClass } = this.props;
        if (!enable) {
            return null;
        }
        const handlers = directions.map(dir => {
            if (enable[dir as Direction] !== false) {
                return (
                    <ResizableHandler
                        key={dir}
                        direction={dir as Direction}
                        onResizeStart={this.foundation.onResizeStart}
                        style={handleStyle && handleStyle[dir]}
                        className={handleClass && handleClass[dir]}
                    >
                        {handleNode?.[dir] ?? null}
                    </ResizableHandler>
                );
            }
            return null;
        });
 
        return (
            <div className={handleWrapperClass} style={handleWrapperStyle}>
                {handlers}
            </div>
        );
    }

    render() {
        const { className, style, children, maxHeight, maxWidth, minHeight, minWidth } = this.props;
        const resizeStyle: React.CSSProperties = {
            userSelect: this.state.isResizing ? 'none' : 'auto',
            maxWidth: maxWidth,
            maxHeight: maxHeight,
            minWidth: minWidth,
            minHeight: minHeight,
            ...style,
            ...this.foundation.sizeStyle,
        };

        if (this.state?.flexBasis) {
            style.flexBasis = this.state.flexBasis;
        }

        return (
            <div
                style={resizeStyle}
                className={classNames(className, prefixCls + '-resizable')}
                ref={this.resizableRef}
                {...this.getDataAttr(this.props)}
            >
                {this.state.isResizing && <div style={this.state.backgroundStyle} className={classNames(className, prefixCls + '-background')}/>}
                {children}
                {this.renderResizeHandler()}
            </div>
        );
    }
}

export default Resizable;