import React, { AriaAttributes } from 'react';
import BaseComponent from '../_base/baseComponent';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { noop, debounce, throttle, find, map, findIndex, times } from 'lodash';

import { cssClasses, numbers, strings } from '@douyinfe/semi-foundation/scrollList/constants';
import ItemFoundation, { Item, ScrollItemAdapter } from '@douyinfe/semi-foundation/scrollList/itemFoundation';
import animatedScrollTo from '@douyinfe/semi-foundation/scrollList/scrollTo';
import isElement from '@douyinfe/semi-foundation/utils/isElement';
import { Motion } from '../_base/base';

const msPerFrame = 1000 / 60;
const blankReg = /^\s*$/;
const wheelMode = 'wheel';
interface DebounceSelectFn {
    (e: React.UIEvent, newSelectedNode: HTMLElement): void;
    cancel(): void
}
export interface ScrollItemProps<T extends Item> {
    mode?: string;
    cycled?: boolean;
    list?: T[];
    selectedIndex?: number;
    onSelect?: (data: T) => void;
    transform?: (value: any, text: string) => string;
    className?: string;
    motion?: Motion;
    style?: React.CSSProperties;
    type?: string | number; // used to identify the scrollItem, used internally by the semi component, and does not need to be exposed to the user
    'aria-label'?: AriaAttributes['aria-label']
}

export interface ScrollItemState {
    prependCount: number;
    appendCount: number
}
export default class ScrollItem<T extends Item> extends BaseComponent<ScrollItemProps<T>, ScrollItemState> {
    static propTypes = {
        mode: PropTypes.oneOf(strings.MODE),
        cycled: PropTypes.bool,
        list: PropTypes.array,
        selectedIndex: PropTypes.number,
        onSelect: PropTypes.func,
        transform: PropTypes.func,
        className: PropTypes.string,
        style: PropTypes.object,
        motion: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
        type: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    };

    static defaultProps = {
        selectedIndex: 0,
        motion: true,
        // transform: identity,
        list: [] as const,
        onSelect: noop,
        cycled: false,
        mode: wheelMode,
    };

    selectedNode: HTMLElement;
    willSelectNode: HTMLElement;
    list: HTMLElement;
    wrapper: HTMLElement;
    selector: unknown;
    scrollAnimation: any;
    scrolling: boolean;
    throttledAdjustList: DebounceSelectFn;
    debouncedSelect: DebounceSelectFn;

    constructor(props = {}) {
        super(props);

        this.state = {
            prependCount: 0,
            appendCount: 0,
            // selectedIndex: props.selectedIndex,
            // fakeSelectedIndex: props.selectedIndex,
        };

        this.selectedNode = null;
        this.willSelectNode = null;
        this.list = null;
        this.wrapper = null;
        this.selector = null;

        this.scrollAnimation = null;

        // cache if select action comes from outside

        this.foundation = new ItemFoundation<ScrollItemProps<T>, ScrollItemState, T>(this.adapter);

        this.throttledAdjustList = throttle((e, nearestNode) => {
            this.foundation.adjustInfiniteList(this.list, this.wrapper, nearestNode);
        }, msPerFrame);

        this.debouncedSelect = debounce((e, nearestNode) => {
            this._cacheSelectedNode(nearestNode);
            this.foundation.selectNode(nearestNode, this.list);
        }, msPerFrame * 2);
    }

    get adapter(): ScrollItemAdapter<ScrollItemProps<T>, ScrollItemState, T> {
        return {
            ...super.adapter,
            setState: (states, callback) => this.setState({ ...states } as ScrollItemState, callback),
            setPrependCount: prependCount => this.setState({ prependCount }),
            setAppendCount: appendCount => this.setState({ appendCount }),
            isDisabledIndex: this.isDisabledIndex,
            setSelectedNode: selectedNode => this._cacheWillSelectNode(selectedNode),
            notifySelectItem: (...args) => this.props.onSelect(...args),
            scrollToCenter: this.scrollToCenter,
        };
    }
    componentWillUnmount() {
        if (this.props.cycled) {
            this.throttledAdjustList.cancel();
            this.debouncedSelect.cancel();
        }
    }
    componentDidMount() {
        this.foundation.init();

        const { mode, cycled, selectedIndex, list } = this.props;

        const selectedNode = this.getNodeByIndex(
            typeof selectedIndex === 'number' && selectedIndex > -1 ? selectedIndex : 0
        ) as HTMLElement;

        this._cacheSelectedNode(selectedNode);
        this._cacheWillSelectNode(selectedNode);

        if (mode === wheelMode && cycled) {
            this.foundation.initWheelList(this.list, this.wrapper, () => {
                // we have to scroll in next tick
                // setTimeout(() => {
                this.scrollToNode(selectedNode, 0);
                // });
            });
        } else {
            this.scrollToNode(selectedNode, 0);
        }
    }

    componentDidUpdate(prevProps: ScrollItemProps<T>) {
        const { selectedIndex } = this.props;

        // smooth scroll to selected option
        if (prevProps.selectedIndex !== selectedIndex) {
            const willSelectIndex = this.getIndexByNode(this.willSelectNode);

            if (!this.indexIsSame(willSelectIndex, selectedIndex)) {
                const newSelectedNode = this.getNodeByOffset(
                    this.selectedNode,
                    selectedIndex - prevProps.selectedIndex,
                    this.list
                );
                this._cacheWillSelectNode(newSelectedNode);
            }

            this._cacheSelectedNode(this.willSelectNode);

            this.scrollToIndex(selectedIndex);
        }
    }

    _cacheNode = (name: string, node: Element) =>
        name && node && Object.prototype.hasOwnProperty.call(this, name) && (this[name] = node);

    _cacheSelectedNode = (selectedNode: Element) => this._cacheNode('selectedNode', selectedNode);

    _cacheWillSelectNode = (node: Element) => this._cacheNode('willSelectNode', node);

    _cacheListNode = (list: Element) => this._cacheNode('list', list);

    _cacheSelectorNode = (selector: Element) => this._cacheNode('selector', selector);

    _cacheWrapperNode = (wrapper: Element) => this._cacheNode('wrapper', wrapper);

    /* istanbul ignore next */
    _isFirst = (node: Element) => {
        const { list } = this;

        if (isElement(node) && isElement(list)) {
            const chilren = list.children;
            const index = findIndex(chilren, node);

            return index === 0;
        }

        return false;
    };


    /* istanbul ignore next */
    _isLast = (node: Element) => {
        const { list } = this;

        if (isElement(node) && isElement(list)) {
            const { children } = list;
            const index = findIndex(children, node);

            return index === children.length - 1;
        }

        return false;
    };

    /**
     *
     * @param {HTMLElement} refNode
     * @param {number} offset
     * @param {HTMLElement} listWrapper
     *
     * @returns {HTMLElement}
     */
    getNodeByOffset(refNode: Element, offset: number, listWrapper: Element) {
        const { list } = this.props;

        if (
            isElement(refNode) &&
            isElement(listWrapper) &&
            typeof offset === 'number' &&
            Array.isArray(list) &&
            list.length
        ) {
            offset = offset % list.length;
            const refIndex = this.getIndexByNode(refNode);

            let targetIndex = refIndex + offset;

            while (targetIndex < 0) {
                targetIndex += list.length;
            }

            if (offset) {
                return this.getNodeByIndex(targetIndex);
            }
        }
        return refNode;
    }

    indexIsSame = (index1: number, index2: number) => {
        const { list } = this.props;

        if (list.length) {
            return index1 % list.length === index2 % list.length;
        }
        return undefined;
    };

    isDisabledIndex = (index: number) => {
        const { list } = this.props;

        if (Array.isArray(list) && list.length && index > -1) {
            const size = list.length;
            const indexInData = index % size;

            return this.isDisabledData(list[indexInData]);
        }

        return false;
    };

    isDisabledNode = (node: Element) => {
        const listWrapper = this.list;

        if (isElement(node) && isElement(listWrapper)) {
            const index = findIndex(listWrapper.children, child => child === node);

            return this.isDisabledIndex(index);
        }

        return false;
    };

    isDisabledData = (data: T) => data && typeof data === 'object' && data.disabled;

    isWheelMode = () => this.props.mode === wheelMode;

    addClassToNode = (selectedNode: Element, selectedCls = cssClasses.SELECTED) => {
        const { list } = this;
        selectedNode = selectedNode || this.selectedNode;

        if (isElement(selectedNode) && isElement(list)) {
            const { children } = list;
            const reg = new RegExp(`\\s*${selectedCls}\\s*`, 'g');

            map(children, node => {
                node.className = node.className && node.className.replace(reg, ' ');

                if (blankReg.test(node.className)) {
                    node.className = '';
                }
            });

            if (selectedNode.className && !blankReg.test(selectedNode.className)) {
                selectedNode.className += ` ${selectedCls}`;
            } else {
                selectedNode.className = selectedCls;
            }
        }
    };

    getIndexByNode = (node: Element) => findIndex(this.list.children, node);

    getNodeByIndex = (index: number) => {
        if (index > -1) {
            return find(this.list.children, (node, idx) => idx === index);
        }

        const defaultSelectedNode = find(this.list.children, child => !this.isDisabledNode(child));

        return defaultSelectedNode;
    };

    scrollToIndex = (selectedIndex: number, duration?: number) => {
        // move to selected item
        duration = typeof duration === 'number' ? duration : numbers.DEFAULT_SCROLL_DURATION;
        selectedIndex = selectedIndex == null ? this.props.selectedIndex : selectedIndex;

        // this.isWheelMode() && this.addClassToNode();
        this.scrollToNode(this.selectedNode, duration);
    };

    scrollToNode = (node: HTMLElement, duration: number) => {
        const { wrapper } = this;
        const wrapperHeight = wrapper.offsetHeight;
        const itemHeight = this.getItmHeight(node);
        const targetTop = (node.offsetTop || this.list.children.length * itemHeight / 2) - (wrapperHeight - itemHeight) / 2;

        this.scrollToPos(targetTop, duration);
    };

    scrollToPos = (targetTop: number, duration = numbers.DEFAULT_SCROLL_DURATION) => {
        const { wrapper } = this;

        // this.isWheelMode() && this.addClassToNode();

        if (duration && this.props.motion) {
            if (this.scrollAnimation) {
                this.scrollAnimation.destroy();
                this.scrolling = false;
            }

            if (wrapper.scrollTop === targetTop) {
                if (this.isWheelMode()) {
                    const nodeInfo = this.foundation.getNearestNodeInfo(this.list, this.selector);
                    this.addClassToNode(nodeInfo.nearestNode);
                }
            } else {
                this.scrollAnimation = animatedScrollTo(wrapper, targetTop, duration);
                this.scrollAnimation.on('rest', () => {
                    if (this.isWheelMode()) {
                        const nodeInfo = this.foundation.getNearestNodeInfo(this.list, this.selector);
                        this.addClassToNode(nodeInfo.nearestNode);
                    }
                });
                this.scrollAnimation.start();
            }
        } else {
            wrapper.scrollTop = targetTop;
        }
    };

    scrollToSelectItem: React.UIEventHandler = e => {
        const { nearestNode } = this.foundation.getNearestNodeInfo(this.list, this.selector);

        if (this.props.cycled) {
            this.throttledAdjustList(e, nearestNode);
        }

        this.debouncedSelect(e, nearestNode);
    };

    /**
     *
     * reset position to center of the scrollWrapper
     *
     * @param {HTMLElement} selectedNode
     * @param {HTMLElement} scrollWnumber
     * @param {number} duration
     */
    scrollToCenter: ScrollItemAdapter['scrollToCenter'] = (selectedNode, scrollWrapper, duration) => {
        selectedNode = selectedNode || this.selectedNode;
        scrollWrapper = scrollWrapper || this.wrapper;
        if (isElement(selectedNode) && isElement(scrollWrapper)) {
            const scrollRect = scrollWrapper.getBoundingClientRect();
            const selectedRect = selectedNode.getBoundingClientRect();

            const targetTop =
                scrollWrapper.scrollTop +
                (selectedRect.top - (scrollRect.top + scrollRect.height / 2 - selectedRect.height / 2));

            this.scrollToPos(targetTop, typeof duration === 'number' ? duration : numbers.DEFAULT_SCROLL_DURATION);
        }
    };

    clickToSelectItem: React.MouseEventHandler = e => {
        // const index = this.foundation.selectNearestIndex(e.nativeEvent, this.list);
        e && e.nativeEvent && e.nativeEvent.stopImmediatePropagation();
        const { targetNode: node, infoInList } = this.foundation.getTargetNode(e, this.list);

        if (node && infoInList && !infoInList.disabled) {
            this.debouncedSelect(null, node);
        }
    };

    getItmHeight = (itm: HTMLElement) => (itm && itm.offsetHeight) || numbers.DEFAULT_ITEM_HEIGHT;

    renderItemList = (prefixKey = '') => {
        const { selectedIndex, mode, transform: commonTrans, list } = this.props;

        return list.map((item, index) => {
            const { transform: itemTrans } = item;

            const transform = typeof itemTrans === 'function' ? itemTrans : commonTrans;
            const selected = selectedIndex === index;
            const cls = classnames({
                [`${cssClasses.PREFIX}-item-sel`]: selected && mode !== wheelMode,
                [`${cssClasses.PREFIX}-item-disabled`]: Boolean(item.disabled),
            });

            let text = '';

            if (selected) {
                if (typeof transform === 'function') {
                    text = transform(item.value, item.text);
                } else {
                    text = item.text == null ? item.value : item.text;
                }
            } else {
                text = item.text == null ? item.value : item.text;
            }

            const events: { onClick?: () => void } = {};

            if (!this.isWheelMode() && !item.disabled) {
                events.onClick = () => this.foundation.selectIndex(index, this.list);
            }

            return (
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                <li
                    key={prefixKey + index}
                    {...events}
                    className={cls}
                    // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
                    role="option"
                    // 
                    // aria-selected={selected}
                    aria-disabled={item.disabled}
                >
                    {text}
                </li>
            );
        });
    };

    renderNormalList = () => {
        const { list, className, style } = this.props;

        const inner = this.renderItemList();

        const wrapperCls = classnames(`${cssClasses.PREFIX}-item`, className);

        return (
            <div style={style} className={wrapperCls} ref={this._cacheWrapperNode}>
                <ul
                    role="listbox"
                    aria-multiselectable={false}
                    aria-label={this.props['aria-label']}
                    ref={this._cacheListNode}
                >
                    {inner}
                </ul>
            </div>
        );
    };

    /**
     * List of Rendering Unlimited Modes
     */
    renderInfiniteList = () => {
        const { list, cycled, className, style } = this.props;
        const { prependCount, appendCount } = this.state;

        const prependList = times(prependCount).reduce((arr, num) => {
            const items = this.renderItemList(`pre_${num}_`);
            arr.unshift(...items);

            return arr;
        }, []);
        const appendList = times(appendCount).reduce((arr, num) => {
            const items = this.renderItemList(`app_${num}_`);
            arr.push(...items);
            return arr;
        }, []);

        const inner = this.renderItemList();

        const listWrapperCls = classnames(`${cssClasses.PREFIX}-list-outer`, {
            [`${cssClasses.PREFIX}-list-outer-nocycle`]: !cycled,
        });

        const wrapperCls = classnames(`${cssClasses.PREFIX}-item-wheel`, className);

        const selectorCls = classnames(`${cssClasses.PREFIX}-selector`);

        const preShadeCls = classnames(`${cssClasses.PREFIX}-shade`, `${cssClasses.PREFIX}-shade-pre`);
        const postShadeCls = classnames(`${cssClasses.PREFIX}-shade`, `${cssClasses.PREFIX}-shade-post`);

        return (
            <div className={wrapperCls} style={style}>
                <div className={preShadeCls} />
                <div className={selectorCls} ref={this._cacheSelectorNode} />
                <div className={postShadeCls} />
                <div className={listWrapperCls} ref={this._cacheWrapperNode} onScroll={this.scrollToSelectItem}>
                    <ul
                        role="listbox"
                        aria-label={this.props['aria-label']}
                        aria-multiselectable={false}
                        ref={this._cacheListNode}
                        onClick={this.clickToSelectItem}
                    >
                        {prependList}
                        {inner}
                        {appendList}
                    </ul>
                </div>
            </div>
        );
    };

    render() {
        return this.isWheelMode() ? this.renderInfiniteList() : this.renderNormalList();
    }
}
