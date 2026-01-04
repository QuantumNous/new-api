import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { strings } from './constants';
import { get, cloneDeep } from 'lodash';
import copy from 'fast-copy';

const Boundary = strings.BOUNDARY_MAP;
const OverflowDirection = strings.OVERFLOW_DIR;

export interface OverflowListAdapter extends DefaultAdapter {
    updateStates: (state: any) => void;
    updateVisibleState: (visible: Map<string, boolean>) => void;
    notifyIntersect: (res: any) => void;
    getItemSizeMap: () => Map<string, number>
}

class OverflowListFoundation extends BaseFoundation<OverflowListAdapter> {

    constructor(adapter: OverflowListAdapter) {
        super({ ...adapter });
    }

    previousY = undefined;

    isScrollMode = (): boolean => {
        const { renderMode } = this.getProps();
        return renderMode === 'scroll';
    };

    getOverflowItem(): Array<Array<Record<string, any>>> {
        const { items } = this.getProps();
        const { visibleState, overflow } = this.getStates();
        if (!this.isScrollMode()) {
            return overflow;
        }


        const visibleStateArr = items.map(({ key }: { key: string }) => Boolean(visibleState.get(key)));
        const visibleStart = visibleStateArr.indexOf(true);
        const visibleEnd = visibleStateArr.lastIndexOf(true);

        const overflowList = [];
        overflowList[0] = visibleStart >= 0 ? items.slice(0, visibleStart) : [];
        overflowList[1] = visibleEnd >= 0 ? items.slice(visibleEnd + 1, items.length) : items.slice();
        return overflowList;
    }

    handleIntersect(entries: Array<IntersectionObserverEntry>): void {
        const visibleState = copy(this.getState('visibleState'));

        const res = {};
        entries.forEach(entry => {
            const itemKey: string = get(entry, 'target.dataset.scrollkey');
            const visible = entry.isIntersecting;
            res[itemKey] = entry;
            visibleState.set(itemKey, visible);
        });
        let someItemVisible = false;
        for (const value of visibleState.values()) {
            if (value) {
                someItemVisible = true;
                break;
            }
        }
        // Any item is visible, indicating that the List is visible
        const wholeListVisible = someItemVisible;
        // If scrolling in the vertical direction makes the List invisible, no processing is required. 
        // If this.previousY is undefined, it means that the List is mounted for the first time and will not be processed.
        const [entry1] = entries;
        const currentY = entry1.boundingClientRect.y;
        if (!wholeListVisible && this.previousY !== undefined && currentY !== this.previousY) {
            this.previousY = currentY;
            return;
        }
        this.previousY = currentY;
        this._adapter.updateVisibleState(visibleState);
        this._adapter.notifyIntersect(res);
    }

    getReversedItems = ()=>{
        const { items } = this.getProps();
        return copy(items).reverse();
    }
    handleCollapseOverflow() {
        const { minVisibleItems, collapseFrom } = this.getProps();
        const { overflowWidth, containerWidth, pivot: statePivot, overflowStatus } = this.getStates();
        const { items, onOverflow } = this.getProps();
        let itemWidths = overflowWidth, _pivot = 0;
        let overflowed = false;
        for (const size of this._adapter.getItemSizeMap().values()) {
            itemWidths += size;
            // 触发overflow
            if (itemWidths > containerWidth) {
                overflowed = true;
                break;
            }
            // 顺利遍历完整个列表，说明不存在overflow，直接渲染全部
            if (_pivot === items.length - 1) {
                this._adapter.updateStates({
                    overflowStatus: "normal",
                    pivot: items.length - 1,
                    visible: items,
                    overflow: []
                });
                break;
            }
            _pivot++;
        }
        if (overflowed) {
            const pivot = Math.max(minVisibleItems, _pivot);
            const isCollapseFromStart = collapseFrom === Boundary.START;
            const visible = isCollapseFromStart ? this.getReversedItems().slice(0, pivot).reverse() : items.slice(0, pivot);
            const overflow = isCollapseFromStart ? this.getReversedItems().slice(pivot).reverse() : items.slice(pivot);
            this._adapter.updateStates({
                overflowStatus: "overflowed",
                pivot: pivot,
                visible,
                overflow,
            });
            // trigger onOverflow
            if (statePivot !== pivot) {
                onOverflow(overflow);
            }
            return;
        }
    }

}

export default OverflowListFoundation;