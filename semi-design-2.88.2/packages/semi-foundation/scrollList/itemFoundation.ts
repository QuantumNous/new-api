import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import isElement from '../utils/isElement';
import { slice, find, findIndex } from 'lodash';
import { append, prepend } from '../utils/dom';

export interface Item {
    [x: string]: any;
    transform?: (value: any, text: string) => string;
    value: any;
    text?: string;
    disabled?: boolean
}

export interface ScrollItemAdapter<P = Record<string, any>, S = Record<string, any>, I = Item> extends DefaultAdapter<P, S> {
    setPrependCount: (prependCount: number) => void;
    setAppendCount: (appendCount: number) => void;
    setSelectedNode: (el: HTMLElement) => void;
    isDisabledIndex: (i: number) => boolean;
    notifySelectItem: (data: I) => void;
    scrollToCenter: (selectedNode: Element, scrollWrapper?: Element, duration?: number) => void
}

export default class ItemFoundation<P = Record<string, any>, S = Record<string, any>, I = Item> extends BaseFoundation<ScrollItemAdapter<P, S, I>, P, S> {
    _cachedSelectedNode: HTMLElement = null;

    selectIndex(index: number, listWrapper: HTMLElement) {
        const { type, list } = this.getProps();
        if (index > -1 && Array.isArray(list) && list.length && isElement(listWrapper)) {
            const indexInData = index % list.length;

            const item = list[indexInData];
            const node = listWrapper.children[index] as HTMLElement;

            this._adapter.setSelectedNode(node);
            this._adapter.notifySelectItem({
                ...item,
                value: item.value,
                type,
                index: indexInData,
            });
        }
    }

    selectNode(node: HTMLElement, listWrapper: HTMLElement) {
        const { type, list: data } = this.getProps();
        if (isElement(node) && isElement(listWrapper)) {
            const indexInList = findIndex(listWrapper.children, ele => ele === node);
            const indexInData = indexInList % data.length;

            const cachedIndexInList = findIndex(listWrapper.children, ele => ele === this._cachedSelectedNode);
            const cachedIndexData = cachedIndexInList % data.length;

            const item = data[indexInData];
            this._adapter.setSelectedNode(node);
            this._adapter.scrollToCenter(node);

            // Avoid triggerring notifySelectItem twice,
            // because that scroll event will be trigger
            // when you click to select an item.
            if (this._cachedSelectedNode !== node) {
                this._cachedSelectedNode = node;

                if (cachedIndexData !== indexInData) {
                    this._adapter.notifySelectItem({
                        ...item,
                        value: item.value,
                        type,
                        index: indexInData,
                    });
                }
            }
        }
    }

    /**
     *
     * @param {HTMLElement} listWrapper
     * @param {HTMLElement} scrollWrapper
     * @param {number} ratio
     * @returns {boolean}
     */
    shouldAppend(listWrapper: HTMLElement, scrollWrapper: HTMLElement, ratio = 2) {
        const tag = 'li';
        if (isElement(listWrapper) && isElement(scrollWrapper)) {
            const itemNodes = listWrapper.querySelectorAll(tag);
            const lastNode = itemNodes[itemNodes.length - 1];
            const { list } = this.getProps();

            if (lastNode) {
                const scrollRect = scrollWrapper.getBoundingClientRect();
                const lastRect = lastNode.getBoundingClientRect();

                const listHeight = lastRect.height * list.length;
                let baseTop = lastRect.top;
                let count = 0;

                while (baseTop <= scrollRect.top + scrollRect.height * ratio) {
                    count += 1;
                    baseTop += listHeight;
                }

                return count;
            }
        }

        return false;
    }

    /**
     *
     * @param {HTMLElement} listWrapper
     * @param {HTMLElement} scrollWrapper
     * @param {number} ratio
     *
     * @returns {boolean}
     */
    shouldPrepend(listWrapper: HTMLElement, scrollWrapper: HTMLElement, ratio = 2) {
        const tag = 'li';

        if (isElement(listWrapper) && isElement(scrollWrapper)) {
            const itemNodes = listWrapper.querySelectorAll(tag);
            const firstNode = itemNodes[0];
            const { list } = this.getProps();

            if (firstNode) {
                const scrollRect = scrollWrapper.getBoundingClientRect();
                const firstRect = firstNode.getBoundingClientRect();

                const listHeight = firstRect.height * list.length;

                let baseTop = firstRect.top;
                let count = 0;

                while (baseTop + firstRect.height >= scrollRect.top - scrollRect.height * ratio) {
                    count += 1;
                    baseTop -= listHeight;
                }

                return count;
            }
        }

        return 0;
    }

    /**
     *
     * @param {HTMLElement} listWrapper
     * @param {HTMLElement} wrapper
     * @param {Function} [callback]
     */
    initWheelList(listWrapper: HTMLElement, wrapper: HTMLElement, callback: () => void) {
        const { list } = this.getProps();
        if (isElement(wrapper) && isElement(listWrapper) && list && list.length) {
            const allNodes = listWrapper.children;
            const baseNodes = slice(allNodes, 0, list.length);

            const prependCount = this.shouldPrepend(listWrapper, wrapper);
            const appendCount = this.shouldAppend(listWrapper, wrapper);

            // this._adapter.setPrependCount(prependCount);
            // this._adapter.setAppendCount(appendCount);

            this._adapter.setState(
                {
                    prependCount,
                    appendCount,
                } as any,
                callback
            );
        }
    }

    /**
     *
     * @param {HTMLElement} listWrapper
     * @param {HTMLElement} wrapper
     * @param {HTMLElement} [nearestNode]
     */
    adjustInfiniteList(listWrapper: HTMLElement, wrapper: HTMLElement, nearestNode: HTMLElement) {
        const { list } = this.getProps();
        const nodeTag = 'li';
        if (isElement(wrapper) && isElement(listWrapper) && list && list.length) {
            const allNodes = listWrapper.querySelectorAll(nodeTag);
            const total = allNodes.length;
            const ratio = 1;

            const prependCount = this.shouldPrepend(listWrapper, wrapper, ratio);
            const appendCount = this.shouldAppend(listWrapper, wrapper, ratio);

            // while (this.shouldPrepend(listWrapper, wrapper, nearestNode)) {
            if (prependCount) {
                // move last nodes to first position

                for (let i = 0; i < prependCount; i++) {
                    const nodes = slice(allNodes, total - list.length * (i + 1), total - list.length * i);
                    prepend(listWrapper, ...nodes);
                }
            }

            // while (this.shouldAppend(listWrapper, wrapper, nearestNode)) {
            if (appendCount) {
                for (let i = 0; i < appendCount; i++) {
                    const nodes = slice(allNodes, i * list.length, (i + 1) * list.length);
                    append(listWrapper, ...nodes);
                }
            }
        }
    }

    /**
     *
     * @param {HTMLElement} listWrapper
     * @param {HTMLElement} selector
     *
     */
    getNearestNodeInfo(listWrapper: HTMLElement, selector: HTMLElement) {
        if (isElement(listWrapper) && isElement(selector)) {
            const selectorRect = selector.getBoundingClientRect();
            const selectorTop = selectorRect.top;
            const itemNodes = listWrapper.querySelectorAll('li');

            let nearestNode: HTMLElement = null;
            let nearestIndex = -1;
            let nearestDistance = Infinity;

            Array.from(itemNodes).map((node, index) => {
                const rect = node.getBoundingClientRect();
                const rectTop = rect.top;
                const absDistance = Math.abs(rectTop - selectorTop);

                if (absDistance < nearestDistance && !this._adapter.isDisabledIndex(index)) {
                    nearestDistance = absDistance;
                    nearestNode = node;
                    nearestIndex = index;
                }
            });

            return { nearestNode, nearestIndex };
        }
        return undefined;
    }

    /**
     *
     * @param {HTMLElement} listWrapper
     *
     * @param {HTMLElement|null}
     */
    getTargetNode(e: any, listWrapper: HTMLElement) {
        if (e && isElement(listWrapper)) {
            const targetTagName = 'li';
            const currentTarget = e.target;
            const itemNodes = listWrapper.querySelectorAll(targetTagName);
            const list = this.getProp('list');
            const length = Array.isArray(list) ? list.length : 0;

            let targetIndex = -1;
            let indexInList = -1;
            let infoInList = null;
            const targetNode = find(itemNodes, (node, index) => {
                if (node === currentTarget || node.contains(currentTarget)) {
                    targetIndex = index;
                    if (length > 0) {
                        indexInList = index % length;
                    }
                    return true;
                }
                return undefined;
            });

            if (indexInList > -1) {
                infoInList = list[indexInList];
            }

            return {
                targetNode,
                targetIndex,
                indexInList,
                infoInList,
            };
        }

        return null;
    }
}
