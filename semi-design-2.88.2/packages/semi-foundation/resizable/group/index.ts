import { getItemDirection, getPixelSize } from "../utils";
import BaseFoundation, { DefaultAdapter } from '../../base/foundation';
import { ResizeStartCallback, ResizeCallback, ResizeEventType } from "../types";
import { adjustNewSize, judgeConstraint, getOffset } from "../utils";
import { debounce } from "lodash";
export interface ResizeHandlerAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    registerEvents: () => void;
    unregisterEvents: () => void
}

export class ResizeHandlerFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<ResizeHandlerAdapter<P, S>, P, S> {
    constructor(adapter: ResizeHandlerAdapter<P, S>) {
        super({ ...adapter });
    }

    init(): void {
        this._adapter.registerEvents();
    }

    destroy(): void {
        this._adapter.unregisterEvents();
    }
}

export interface ResizeItemAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
}

export class ResizeItemFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<ResizeItemAdapter<P, S>, P, S> {
    constructor(adapter: ResizeItemAdapter<P, S>) {
        super({ ...adapter });
    }

    init(): void {
    }

    destroy(): void {
    }
}

export interface ResizeGroupAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    getGroupRef: () => HTMLDivElement | null;
    getItem: (index: number) => HTMLDivElement;
    getItemCount: () => number;
    getHandler: (index: number) => HTMLDivElement;
    getHandlerCount: () => number;
    getItemMin: (index: number) => string;
    getItemMax: (index: number) => string;
    getItemStart: (index: number) => ResizeStartCallback;
    getItemChange: (index: number) => ResizeCallback;
    getItemEnd: (index: number) => ResizeCallback;
    getItemDefaultSize: (index: number) => string | number;
    registerEvents: (type: ResizeEventType) => void;
    unregisterEvents: (type: ResizeEventType) => void
}

export class ResizeGroupFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<ResizeGroupAdapter<P, S>, P, S> {
    constructor(adapter: ResizeGroupAdapter<P, S>) {
        super({ ...adapter });
    }

    get groupRef(): HTMLDivElement | null {
        return this._adapter.getGroupRef();
    }

    get groupSize(): number {
        const { direction } = this.getProps();
        let groupSize = direction === 'horizontal' ? this.groupRef.offsetWidth : this.groupRef.offsetHeight;
        return groupSize;
    }

    direction: 'horizontal' | 'vertical'
    itemMinusMap: Map<number, number>; // 这个是为了给handler留出空间，方便维护每一个item的size为cal(percent% - minus)
    totalMinus: number;
    itemPercentMap: Map<number, number>; // 内部维护一个百分比数组，消除浮点计算误差
    type?: ResizeEventType;


    init(): void {
        this.direction = this.getProp('direction');
        this.itemMinusMap = new Map();
        this.itemPercentMap = new Map();
        this.initSpace();
    }
    get window(): Window | null {
        return this.groupRef.ownerDocument.defaultView as Window ?? null;
    }

    
    registerEvents = () => {
        this._adapter.registerEvents(this.type);
    }

    unregisterEvents = () => {
        this._adapter.unregisterEvents(this.type);
    }

    onResizeStart = (handlerIndex: number, e: MouseEvent | Touch, type: ResizeEventType) => { // handler ref
        this.type = type;
        let { clientX, clientY } = e;
        let lastItem = this._adapter.getItem(handlerIndex), nextItem = this._adapter.getItem(handlerIndex + 1);
        let lastOffset: number, nextOffset: number;
        // offset caused by padding and border
        const lastStyle = this.window.getComputedStyle(lastItem);
        const nextStyle = this.window.getComputedStyle(nextItem);

        lastOffset = getOffset(lastStyle, this.direction) + this.itemMinusMap.get(handlerIndex);
        nextOffset = getOffset(nextStyle, this.direction) + this.itemMinusMap.get(handlerIndex + 1);
        let lastItemSize = (this.direction === 'horizontal' ? lastItem.offsetWidth : lastItem.offsetHeight) + this.itemMinusMap.get(handlerIndex),
            nextItemSize = (this.direction === 'horizontal' ? nextItem.offsetWidth : nextItem.offsetHeight) + this.itemMinusMap.get(handlerIndex + 1);
        const states = this.getStates();
        this.setState({
            isResizing: true,
            originalPosition: {
                x: clientX,
                y: clientY,
                lastItemSize,
                nextItemSize,
                lastOffset,
                nextOffset,
            },
            backgroundStyle: {
                ...states.backgroundStyle,
                cursor: this.window.getComputedStyle(e.target as HTMLElement).cursor || 'auto',
            },
            curHandler: handlerIndex
        } as any);
        this.registerEvents();

        let lastStart = this._adapter.getItemStart(handlerIndex), 
            nextStart = this._adapter.getItemStart(handlerIndex + 1);
        let [lastDir, nextDir] = getItemDirection(this.direction);
        if (lastStart) {
            lastStart(e, lastDir as any);
        }
        if (nextStart) {
            nextStart(e, nextDir as any);
        }
    }

    onMouseMove = (e: MouseEvent) => {
        this.onResizing(e);
    }

    onTouchMove = (e: TouchEvent) => {
        // prevent page move in mobile
        e.preventDefault();
        this.onResizing(e);
    }


    onResizing = (e: MouseEvent | TouchEvent) => {
        const state = this.getStates();
        if (!state.isResizing) {
            return;
        }
        const { curHandler, originalPosition } = state;
        let { x: initX, y: initY, lastItemSize, nextItemSize, lastOffset, nextOffset } = originalPosition;
        let { clientX, clientY } = this.type === 'mouse' ? e : (e as any).targetTouches[0];

        const props = this.getProps();
        const { direction } = props;
        let lastItem = this._adapter.getItem(curHandler), nextItem = this._adapter.getItem(curHandler + 1);
        let parentSize = this.groupSize;
        let delta = direction === 'horizontal' ? (clientX - initX) : (clientY - initY);
        let lastNewSize = lastItemSize + delta;
        let nextNewSize = nextItemSize - delta;

        // 判断是否超出限制
        let lastFlag = judgeConstraint(lastNewSize, this._adapter.getItemMin(curHandler), this._adapter.getItemMax(curHandler), parentSize, lastOffset),
            nextFlag = judgeConstraint(nextNewSize, this._adapter.getItemMin(curHandler + 1), this._adapter.getItemMax(curHandler + 1), parentSize, nextOffset);

        if (lastFlag) {
            lastNewSize = adjustNewSize(lastNewSize, this._adapter.getItemMin(curHandler), this._adapter.getItemMax(curHandler), parentSize, lastOffset);
            nextNewSize = lastItemSize + nextItemSize - lastNewSize;
        }

        if (nextFlag) {
            nextNewSize = adjustNewSize(nextNewSize, this._adapter.getItemMin(curHandler + 1), this._adapter.getItemMax(curHandler + 1), parentSize, nextOffset);
            lastNewSize = lastItemSize + nextItemSize - nextNewSize;
        }

        let lastItemPercent = this.itemPercentMap.get(curHandler),
            nextItemPercent = this.itemPercentMap.get(curHandler + 1);

        let lastNewPercent = (lastNewSize) / parentSize * 100;
        let nextNewPercent = lastItemPercent + nextItemPercent - lastNewPercent; // 消除浮点误差
        this.itemPercentMap.set(curHandler, lastNewPercent);
        this.itemPercentMap.set(curHandler + 1, nextNewPercent);
        if (direction === 'horizontal') {     
            lastItem.style.width = `calc(${lastNewPercent}% - ${this.itemMinusMap.get(curHandler)}px)`;
            nextItem.style.width = `calc(${nextNewPercent}% - ${this.itemMinusMap.get(curHandler + 1)}px)`;
        } else if (direction === 'vertical') {
            lastItem.style.height = `calc(${lastNewPercent}% - ${this.itemMinusMap.get(curHandler)}px)`;
            nextItem.style.height = `calc(${nextNewPercent}% - ${this.itemMinusMap.get(curHandler + 1)}px)`;
        }

        let lastFunc = this._adapter.getItemChange(curHandler),
            nextFunc = this._adapter.getItemChange(curHandler + 1);
        let [lastDir, nextDir] = getItemDirection(this.direction);
        if (lastFunc) {
            lastFunc( { width: lastItem.offsetWidth, height: lastItem.offsetHeight }, e, lastDir as any);
        }
        if (nextFunc) {
            nextFunc( { width: nextItem.offsetWidth, height: nextItem.offsetHeight }, e, nextDir as any);
        }
    }

    onResizeEnd = (e: MouseEvent | TouchEvent) => {
        const { curHandler } = this.getStates();
        let lastItem = this._adapter.getItem(curHandler), nextItem = this._adapter.getItem(curHandler + 1);
        let lastFunc = this._adapter.getItemEnd(curHandler),
            nextFunc = this._adapter.getItemEnd(curHandler + 1);
        let [lastDir, nextDir] = getItemDirection(this.direction);
        if (lastFunc) {
            lastFunc( { width: lastItem.offsetWidth, height: lastItem.offsetHeight }, e, lastDir as any);
        }
        if (nextFunc) {
            nextFunc( { width: nextItem.offsetWidth, height: nextItem.offsetHeight }, e, nextDir as any);
        }
        this.setState({
            isResizing: false,
            curHandler: null
        } as any);
        this.unregisterEvents();
    }

    initSpace = () => {
        const props = this.getProps();
        const { direction } = props;

        // calculate accurate space for group item
        let handlerSizes = new Array(this._adapter.getHandlerCount()).fill(0);
        let parentSize = this.groupSize;
        this.totalMinus = 0;
        for (let i = 0; i < this._adapter.getHandlerCount(); i++) {
            let handlerSize = direction === 'horizontal' ? this._adapter.getHandler(i).offsetWidth : this._adapter.getHandler(i).offsetHeight;
            handlerSizes[i] = handlerSize;
            this.totalMinus += handlerSize;
        }
        
        // allocate size for items which don't have default size
        let totalSizePercent = 0;
        let undefineLoc: Map<number, number> = new Map(), undefinedTotal = 0; // proportion

        for (let i = 0; i < this._adapter.getItemCount(); i++) {
            if (i === 0) {
                this.itemMinusMap.set(i, handlerSizes[i] / 2);
            } else if (i === this._adapter.getItemCount() - 1) {
                this.itemMinusMap.set(i, handlerSizes[i - 1] / 2);
            } else {
                this.itemMinusMap.set(i, handlerSizes[i - 1] / 2 + handlerSizes[i] / 2);
            }
            const child = this._adapter.getItem(i);
            let minSize = this._adapter.getItemMin(i), maxSize = this._adapter.getItemMax(i);
            let minSizePercent = minSize ? getPixelSize(minSize, parentSize) / parentSize * 100 : 0,
                maxSizePercent = maxSize ? getPixelSize(maxSize, parentSize) / parentSize * 100 : 100;
            if (minSizePercent > maxSizePercent) {
                console.warn('[Semi ResizableItem]: min size bigger than max size');
            }    

            let defaultSize = this._adapter.getItemDefaultSize(i);
            if (defaultSize) {
                let itemSizePercent: number;
                if (typeof defaultSize === 'string') {
                    if (defaultSize.endsWith('%')) {
                        itemSizePercent = parseFloat(defaultSize.slice(0, -1));
                        this.itemPercentMap.set(i, itemSizePercent);
                    } else if (defaultSize.endsWith('px')) {
                        itemSizePercent = parseFloat(defaultSize.slice(0, -2)) / parentSize * 100;
                        this.itemPercentMap.set(i, itemSizePercent);
                    } else if (/^-?\d+(\.\d+)?$/.test(defaultSize)) {
                        // 仅由数字组成，表示按比例分配剩下空间
                        undefineLoc.set(i, parseFloat(defaultSize));
                        undefinedTotal += parseFloat(defaultSize);
                        continue;
                    }
                } else if (typeof defaultSize === 'number') {
                    undefineLoc.set(i, defaultSize);
                    undefinedTotal += defaultSize;
                    continue;
                }
                totalSizePercent += itemSizePercent;
                
                if (direction === 'horizontal') {
                    child.style.width = `calc(${itemSizePercent}% - ${this.itemMinusMap.get(i)}px)`;
                } else {
                    child.style.height = `calc(${itemSizePercent}% - ${this.itemMinusMap.get(i)}px)`;
                }
                
                if (itemSizePercent < minSizePercent) {
                    console.warn('[Semi ResizableGroup]: item size smaller than min size');
                } 
                if (itemSizePercent > maxSizePercent) {
                    console.warn('[Semi ResizableGroup]: item size bigger than max size');
                }
            } else {
                undefineLoc.set(i, 1);
                undefinedTotal += 1;
            }
        }
        let undefineSizePercent = 100 - totalSizePercent;
        if (totalSizePercent > 100) {
            console.warn('[Semi ResizableGroup]: total Size bigger than 100%');
            undefineSizePercent = 10; // 如果总和超过100%，则保留10%的空间均分给未定义的item
        }
    
        undefineLoc.forEach((value, key) => {
            const child = this._adapter.getItem(key);
            const percent = value / undefinedTotal * undefineSizePercent;
            this.itemPercentMap.set(key, percent);
            if (direction === 'horizontal') {
                child.style.width = `calc(${percent}% - ${this.itemMinusMap.get(key)}px)`;
            } else {
                child.style.height = `calc(${percent}% - ${this.itemMinusMap.get(key)}px)`;
            }
        });
    }

    ensureConstraint = debounce(() => {
        // 浏览器拖拽时保证px值最大最小仍生效
        const { direction } = this.getProps();
        const itemCount = this._adapter.getItemCount();
        let continueFlag = true;
        for (let i = 0; i < itemCount; i++) {
            const child = this._adapter.getItem(i);
            const childSize = direction === 'horizontal' ? child.offsetWidth : child.offsetHeight;
            // 判断由非鼠标拖拽导致item的size变化过程中是否有超出限制的情况
            const childFlag = judgeConstraint(childSize, this._adapter.getItemMin(i), this._adapter.getItemMax(i), this.groupSize, this.itemMinusMap.get(i));
            if (childFlag) {
                const childNewSize = adjustNewSize(childSize, this._adapter.getItemMin(i), this._adapter.getItemMax(i), this.groupSize, this.itemMinusMap.get(i));
                for (let j = i + 1; j < itemCount; j++) {
                    // 找到下一个没有超出限制的item
                    const item = this._adapter.getItem(j);
                    const itemSize = direction === 'horizontal' ? item.offsetWidth : item.offsetHeight;
                    const itemFlag = judgeConstraint(itemSize, this._adapter.getItemMin(j), this._adapter.getItemMax(j), this.groupSize, this.itemMinusMap.get(j));
                    if (!itemFlag) {
                        let childPercent = this.itemPercentMap.get(i),
                            itemPercent = this.itemPercentMap.get(j);
                        let childNewPercent = childNewSize / this.groupSize * 100;
                        let itemNewPercent = childPercent + itemPercent - childNewPercent;
                        this.itemPercentMap.set(i, childNewPercent);
                        this.itemPercentMap.set(j, itemNewPercent);
                        if (direction === 'horizontal') {
                            child.style.width = `calc(${childNewPercent}% - ${this.itemMinusMap.get(i)}px)`;
                            item.style.width = `calc(${itemNewPercent}% - ${this.itemMinusMap.get(j)}px)`;
                        } else {
                            child.style.height = `calc(${childNewPercent}% - ${this.itemMinusMap.get(i)}px)`;
                            item.style.height = `calc(${itemNewPercent}% - ${this.itemMinusMap.get(j)}px)`;
                        }
                        break;
                    } else {
                        if (j === itemCount - 1) {
                            continueFlag = false;
                            console.warn('[Semi ResizableGroup]: no enough space to adjust min/max size');
                        }
                    }
                }
            }
            if (!continueFlag) {
                break;
            }
        }
    }, 200) 

    destroy(): void {
        
    }
}
