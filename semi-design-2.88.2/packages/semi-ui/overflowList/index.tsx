import React, { CSSProperties, ReactNode, MutableRefObject, RefCallback, ReactElement } from 'react';
import cls from 'classnames';
import BaseComponent from '../_base/baseComponent';
import PropTypes from 'prop-types';
import { isEqual, isFunction, get } from 'lodash';
import { cssClasses, strings, numbers } from '@douyinfe/semi-foundation/overflowList/constants';
import ResizeObserver, { ResizeEntry } from '../resizeObserver';
import IntersectionObserver from './intersectionObserver';

import OverflowListFoundation, { OverflowListAdapter } from '@douyinfe/semi-foundation/overflowList/foundation';

import '@douyinfe/semi-foundation/overflowList/overflowList.scss';
import { getDefaultPropsFromGlobalConfig } from '../_utils';
import copy from 'fast-copy';

const prefixCls = cssClasses.PREFIX;
const Boundary = strings.BOUNDARY_MAP;
const OverflowDirection = strings.OVERFLOW_DIR;
const RenderMode = strings.MODE_MAP;

export type { ReactIntersectionObserverProps } from './intersectionObserver';
export type OverflowItem = Record<string, any>;

type Key = string | number

export interface OverflowListProps {
    className?: string;
    collapseFrom?: 'start' | 'end';
    items?: Array<OverflowItem>;
    minVisibleItems?: number;
    onIntersect?: (res: { [key: string]: IntersectionObserverEntry }) => void;
    onOverflow?: (overflowItems: Array<OverflowItem>) => void;
    overflowRenderer?: (overflowItems: Array<OverflowItem>) => ReactNode | ReactNode[];
    renderMode?: 'collapse' | 'scroll';
    style?: CSSProperties;
    threshold?: number;
    visibleItemRenderer?: (item: OverflowItem, index: number) => ReactElement;
    wrapperClassName?: string;
    wrapperStyle?: CSSProperties;
    itemKey?: Key | ((item: OverflowItem) => Key);
    onVisibleStateChange?: (visibleState: Map<string, boolean>) => void;
    overflowRenderDirection?: "both" | "start" | 'end' // used in tabs, not exposed to user
}

export interface OverflowListState {
    direction?: typeof OverflowDirection.GROW;
    lastOverflowCount?: number;
    overflow?: Array<OverflowItem>;
    visible?: Array<OverflowItem>;
    visibleState?: Map<string, boolean>;
    prevProps?: OverflowListProps;
    itemSizeMap?: Map<Key, number>;
    containerWidth?: number;
    maxCount?: number;
    overflowStatus?: 'calculating' | 'overflowed' | 'normal';
    pivot?: number;
    overflowWidth?: number
}

// reference to https://github.com/palantir/blueprint/blob/1aa71605/packages/core/src/components/overflow-list/overflowList.tsx#L34
class OverflowList extends BaseComponent<OverflowListProps, OverflowListState> {
    static __SemiComponentName__ = "OverflowList";

    static defaultProps = getDefaultPropsFromGlobalConfig(OverflowList.__SemiComponentName__, {
        collapseFrom: 'end',
        minVisibleItems: 0,
        overflowRenderer: (): ReactElement => null,
        renderMode: 'collapse',
        threshold: 0.75,
        visibleItemRenderer: (): ReactElement => null,
        onOverflow: () => null,
        overflowRenderDirection: "both",
    })
    static propTypes = {
        // if render in scroll mode, key is required in items
        className: PropTypes.string,
        collapseFrom: PropTypes.oneOf(strings.BOUNDARY_SET),
        direction: PropTypes.oneOf(strings.POSITION_SET),
        items: PropTypes.array,
        minVisibleItems: PropTypes.number,
        onIntersect: PropTypes.func,
        onOverflow: PropTypes.func,
        overflowRenderer: PropTypes.func,
        renderMode: PropTypes.oneOf(strings.MODE_SET),
        style: PropTypes.object,
        threshold: PropTypes.number,
        visibleItemRenderer: PropTypes.func,
        wrapperClassName: PropTypes.string,
        wrapperStyle: PropTypes.object,
        collapseMask: PropTypes.object,
        overflowRenderDirection: PropTypes.string,
    };

    constructor(props: OverflowListProps) {
        super(props);
        this.state = {
            direction: OverflowDirection.GROW,
            lastOverflowCount: 0,
            overflow: [],
            visible: [],
            containerWidth: 0,
            visibleState: new Map(),
            itemSizeMap: new Map(),
            overflowStatus: "calculating",
            pivot: -1,
            overflowWidth: 0,
            maxCount: 0,
        };
        this.foundation = new OverflowListFoundation(this.adapter);
        this.previousWidths = new Map();
        this.itemRefs = {};
        this.itemSizeMap = new Map();
    }

    static getDerivedStateFromProps(props: OverflowListProps, prevState: OverflowListState): OverflowListState {
        const { prevProps } = prevState;
        const newState: OverflowListState = {};
        newState.prevProps = props;

        const needUpdate = (name: string): boolean => {
            return (!prevProps && name in props) || (prevProps && !isEqual(prevProps[name], props[name]));
        };
        if (needUpdate('items') || needUpdate('style')) {
            // reset visible state if the above props change.
            newState.direction = OverflowDirection.GROW;
            newState.lastOverflowCount = 0;
            newState.maxCount = 0;
            if (props.renderMode === RenderMode.SCROLL) {
                newState.visible = props.items;
                newState.overflow = [];
            } else {
                let maxCount = props.items.length;
                if (Math.floor(prevState.containerWidth / numbers.MINIMUM_HTML_ELEMENT_WIDTH) !== 0) {
                    maxCount = Math.min(maxCount, Math.floor(prevState.containerWidth / numbers.MINIMUM_HTML_ELEMENT_WIDTH));
                }

                const isCollapseFromStart = props.collapseFrom === Boundary.START;
                const visible = isCollapseFromStart ? copy(props.items).reverse().slice(0, maxCount) : props.items.slice(0, maxCount);
                const overflow = isCollapseFromStart ? copy(props.items).reverse().slice(maxCount) : props.items.slice(maxCount);
                newState.visible = visible;
                newState.overflow = overflow;
                newState.maxCount = maxCount;
            }
            newState.pivot = -1;
            newState.overflowStatus = "calculating";
        }
        return newState;
    }

    get adapter(): OverflowListAdapter {
        return {
            ...super.adapter,
            updateVisibleState: (visibleState): void => {
                this.setState({ visibleState }, () => {
                    this.props.onVisibleStateChange?.(visibleState);
                });
            },
            updateStates: (states): void => {
                this.setState({ ...states });
            },
            notifyIntersect: (res): void => {
                this.props.onIntersect && this.props.onIntersect(res);
            },
            getItemSizeMap: () => this.itemSizeMap
        };
    }

    itemRefs: Record<string, any>;

    scroller: HTMLDivElement = null;
    spacer: HTMLDivElement = null;

    previousWidths: Map<Element, number>;

    itemSizeMap: Map<string, number>;

    isScrollMode = (): boolean => {
        const { renderMode } = this.props;
        return renderMode === RenderMode.SCROLL;
    };

    componentDidUpdate(prevProps: OverflowListProps, prevState: OverflowListState): void {

        const prevItemsKeys = prevProps.items.map((item) =>
            item.key
        );
        const nowItemsKeys = this.props.items.map((item) =>
            item.key
        );

        // Determine whether to update by comparing key values
        if (!isEqual(prevItemsKeys, nowItemsKeys)) {
            this.itemRefs = {};
            this.setState({ visibleState: new Map() });
        }

        const { overflow, containerWidth, visible, overflowStatus } = this.state;

        if (this.isScrollMode() || overflowStatus !== "calculating") {
            return;
        }
        this.foundation.handleCollapseOverflow();
    }

    resize = (entries: Array<ResizeEntry> = []): void => {
        const containerWidth = entries[0]?.target.clientWidth;
        this.setState({
            containerWidth,
            overflowStatus: 'calculating',
        });
    };

    reintersect = (entries: Array<IntersectionObserverEntry>): void => {
        this.foundation.handleIntersect(entries);
    };

    mergeRef = (ref: RefCallback<any> | MutableRefObject<any> | null, node: Element, key: Key): void => {
        this.itemRefs[key] = node;
        if (typeof ref === 'function') {
            ref(node);
        } else if (typeof ref === 'object' && ref && 'current' in ref) {
            ref.current = node;
        }
    };

    renderOverflow = (): ReactNode | ReactNode[] => {
        const overflow = this.foundation.getOverflowItem();
        return this.props.overflowRenderer(overflow);
    };

    getItemKey = (item, defaultKey?: Key) => {
        const { itemKey } = this.props;
        if (isFunction(itemKey)) {
            return itemKey(item);
        }
        return get(item, itemKey || 'key', defaultKey);
    }

    renderItemList = () => {
        const { className, wrapperClassName, wrapperStyle, style, visibleItemRenderer, renderMode, collapseFrom } = this.props;

        const { visible, overflowStatus } = this.state;
        let overflow = this.renderOverflow();
        if (!this.isScrollMode()) {
            if (Array.isArray(overflow)) {
                overflow = (
                    <>
                        {overflow}
                    </>
                );
            }
            if (React.isValidElement(overflow)) {
                const child = React.cloneElement(overflow);
                overflow = (<ResizeObserver
                    onResize={([entry]) => {
                        this.setState({
                            overflowWidth: entry.target.clientWidth,
                            overflowStatus: 'calculating'
                        });
                    }}
                >
                    <div className={`${prefixCls}-overflow`}>
                        {child}
                    </div>
                </ResizeObserver>);
            }
        }
        const inner =
            renderMode === RenderMode.SCROLL ?
                (() => {
                    const list = [<div
                        className={cls(wrapperClassName, `${prefixCls}-scroll-wrapper`)}
                        ref={(ref): void => {
                            this.scroller = ref;
                        }}
                        style={{ ...wrapperStyle }}
                        key={`${prefixCls}-scroll-wrapper`}
                    >
                        {visible.map(visibleItemRenderer).map((item: ReactElement) => {
                            const { forwardRef, key } = item as any;
                            return React.cloneElement(item, {
                                ref: (node: any) => this.mergeRef(forwardRef, node, key),
                                'data-scrollkey': `${key}`,
                                key,
                            });
                        })}
                    </div>];
                    if (this.props.overflowRenderDirection === "both") {
                        list.unshift(overflow[0]);
                        list.push(overflow[1]);
                    } else if (this.props.overflowRenderDirection === "start") {
                        list.unshift(overflow[1]);
                        list.unshift(overflow[0]);
                    } else {
                        list.push(overflow[0]);
                        list.push(overflow[1]);
                    }
                    return list;
                })() :
                [
                    collapseFrom === Boundary.START ? overflow : null,
                    visible.map((item, idx) => {
                        const { key } = item;
                        const element = visibleItemRenderer(item, idx);
                        const child = React.cloneElement(element);
                        return (
                            <ResizeObserver
                                key={key ?? idx}
                                onResize={([entry]) => this.onItemResize(entry, item, idx)}
                            >
                                {/* 用div包起来，可以直接在resize回调中拿到宽度，不用通过获取元素的padding, margin, border-width求和计算宽度*/}
                                {/* This div wrap can get width directly rather than do the math of padding, margin, border-width*/}
                                <div key={key ?? idx} className={`${prefixCls}-item`}>
                                    {child}
                                </div>
                            </ResizeObserver>);
                    }),
                    collapseFrom === Boundary.END ? overflow : null,
                ];
        const list = React.createElement(
            'div',
            {
                className: cls(`${prefixCls}`, className),
                style: {
                    ...style,
                    ...(renderMode === RenderMode.COLLAPSE ? {
                        maxWidth: '100%',
                        visibility: overflowStatus === "calculating" ? "hidden" : "visible",
                    } : null)
                },
            },
            ...inner
        );
        return list;
    };

    onItemResize = (entry: ResizeEntry, item: OverflowItem, idx: number) => {
        const key = this.getItemKey(item, idx);
        const width = this.itemSizeMap.get(key);
        if (!width) {
            this.itemSizeMap.set(key, entry.target.clientWidth);
        } else if (width !== entry.target.clientWidth) {
            // 某个item发生resize后，重新计算
            this.itemSizeMap.set(key, entry.target.clientWidth);
            this.setState({
                overflowStatus: 'calculating'
            });
        }
        const { maxCount } = this.state;
        // 已经按照最大值maxCount渲染完毕，触发真正的渲染
        // Already rendered maxCount items, trigger the real rendering
        if (this.itemSizeMap.size === maxCount) {
            this.setState({
                overflowStatus: 'calculating'
            });
        }
    }

    render(): ReactNode {
        const list = this.renderItemList();
        const { renderMode } = this.props;
        if (renderMode === RenderMode.SCROLL) {
            return (
                <IntersectionObserver
                    onIntersect={this.reintersect}
                    root={this.scroller}
                    threshold={this.props.threshold}
                    items={this.itemRefs}
                >
                    {list}
                </IntersectionObserver>
            );
        }
        return <ResizeObserver onResize={this.resize}>{list}</ResizeObserver>;
    }
}

export default OverflowList;
