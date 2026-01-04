import React, { createRef } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { ResizeItemFoundation, ResizeItemAdapter } from '@douyinfe/semi-foundation/resizable/foundation';
import { cssClasses } from '@douyinfe/semi-foundation/resizable/constants';
import BaseComponent from '../../_base/baseComponent';
import { ResizeCallback, ResizeStartCallback } from '@douyinfe/semi-foundation/resizable/types';
import { ResizeContext, ResizeContextProps } from './resizeContext';
import { noop } from 'lodash';

const prefixCls = cssClasses.PREFIX;

export interface ResizeItemProps {
    style?: React.CSSProperties;
    className?: string;
    min?: string;
    max?: string;
    children?: React.ReactNode;
    onResizeStart?: ResizeStartCallback;
    onChange?: ResizeCallback;
    onResizeEnd?: ResizeCallback;
    defaultSize?: string | number
}

export interface ResizeItemState {
}

class ResizeItem extends BaseComponent<ResizeItemProps, ResizeItemState> {
    static propTypes = {
        style: PropTypes.object,
        className: PropTypes.string,
        min: PropTypes.string,
        max: PropTypes.string,
        children: PropTypes.object,
        onResizeStart: PropTypes.func,
        onChange: PropTypes.func,
        onResizeEnd: PropTypes.func,
        defaultSize: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    };

    static defaultProps: Partial<ResizeItemProps> = {
        onResizeStart: noop,
        onChange: noop,
        onResizeEnd: noop,
    };

    constructor(props: ResizeItemProps) {
        super(props);
        this.itemRef = createRef<HTMLDivElement | null>();
        this.foundation = new ResizeItemFoundation(this.adapter);
        this.state = {
            isResizing: false,
        };
        this.itemIndex = -1;
    }

    componentDidMount() {
        this.foundation.init();
        const { min, max, onResizeStart, onChange, onResizeEnd, defaultSize } = this.props;
        if (this.itemIndex === -1) {
            // 开发过程在StrictMode下context方法会执行两次，需要判断一下是否已经注册过
            this.itemIndex = this.context.registerItem(this.itemRef, min, max, defaultSize, onResizeStart, onChange, onResizeEnd);
        }
        this.direction = this.context.direction; // 留一个direction的引用，方便在componentDidUpdate中判断方向是否有变化
    }

    componentDidUpdate(_prevProps: ResizeItemProps) {
        // 支持动态方向，修改item的style
        if (this.context.direction !== this.direction) {
            this.direction = this.context.direction;
            if (this.direction === 'horizontal') {
                const newWidth = this.itemRef.current?.style.height;
                this.itemRef.current.style.width = newWidth;
                this.itemRef.current.style.removeProperty('height');
            } else {
                const newHeight = this.itemRef.current?.style.width;
                this.itemRef.current.style.height = newHeight;
                this.itemRef.current.style.removeProperty('width');
            }
        }
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    get adapter(): ResizeItemAdapter<ResizeItemProps, ResizeItemState> {
        return {
            ...super.adapter,
        };
    }
    static contextType = ResizeContext;
    context: ResizeContextProps;
    direction: 'horizontal' | 'vertical';
    itemRef: React.RefObject<HTMLDivElement | null>;
    itemIndex: number;

    render() {
        const style: React.CSSProperties = {
            ...this.props.style,
        };

        return (
            <div
                style={style}
                className={classNames(this.props.className, prefixCls + '-item')}
                ref={this.itemRef}
            >
                {this.props.children}
            </div>
        );
    }
}


export default ResizeItem;
