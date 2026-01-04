import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { cssClasses } from '@douyinfe/semi-foundation/tree/constants';
import ResizeObserver, { ResizeEntry } from '../resizeObserver';
import { get } from 'lodash';

export interface AutoSizerProps {
    defaultHeight?: number | string;
    defaultWidth?: number | string;
    children?: (info: { width: string | number; height: string | number }) => React.ReactNode;
}

export interface AutoSizerState {
    height: number | string
}

const prefixcls = cssClasses.PREFIX;

export default class AutoSizer extends PureComponent<AutoSizerProps, AutoSizerState> {
    static propTypes = {
        defaultHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        defaultWidth: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    };

    static defaultProps = {
        defaultHeight: '100%',
        defaultWidth: '100%',
    };

    constructor(props: AutoSizerProps) {
        super(props);
        this.state = {
            height: this.props.defaultHeight || 0,
        };
    }

    componentDidMount() {
        const { height } = this.state;
        // if height is a number, pass it directly to virtual-list
        if (typeof height === 'number') {
            return;
        }
    }

    _onResize = (entries: ResizeEntry[]) => {
        // observe parent node height
        const target = entries && entries[1] && entries[1].target;
        if (target) {
            const height = get(target, 'offsetHeight') || 0;
            const style = window.getComputedStyle(target) || {};
            const paddingTop = parseInt(get(style, 'paddingTop'), 10) || 0;
            const paddingBottom = parseInt(get(style, 'paddingBottom'), 10) || 0;
            const newHeight = height - paddingTop - paddingBottom;
            if (this.state.height !== newHeight) {
                this.setState({
                    height: height - paddingTop - paddingBottom,
                });
            }
        }
    };

    render() {
        const { children, defaultWidth, defaultHeight } = this.props;
        const { height } = this.state;
        // Avoid rendering children before the initial measurements have been collected.
        // At best this would just be wasting cycles. Refer to https://github.com/bvaughn/react-virtualized-auto-sizer/
        let bailoutOnChildren = false;

        if (height === 0 || typeof height !== 'number') {
            bailoutOnChildren = true;
        }
        return (
            <ResizeObserver observeParent onResize={this._onResize}>
                <div
                    style={{
                        height: defaultHeight,
                        overflow: 'visible',
                    }}
                    className={`${prefixcls}-auto-wrapper`}
                >
                    {!bailoutOnChildren && children({ height, width: defaultWidth })}
                </div>
            </ResizeObserver>
        );
    }
}
