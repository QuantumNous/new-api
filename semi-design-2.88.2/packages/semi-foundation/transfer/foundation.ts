import { omit } from 'lodash';
import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { BasicValue as BasicTreeValue } from '../tree/foundation';
import { strings } from './constants';
import { _generateGroupedData, _generateTreeData } from './transferUtils';
import arrayMove from '../utils/arrayMove';

export interface BasicDataItem {
    [x: string]: any;
    /* key is required */
    key: string | number;
    label?: any;
    value?: string | number;
    disabled?: boolean;
    style?: any;
    className?: string
}

export type DataItemMap = Map<number | string, BasicDataItem>;

export interface OnSortEndProps {
    oldIndex: number;
    newIndex: number
}

export interface BasicResolvedDataItem extends BasicDataItem {
    _parent?: {
        title: string
    };
    _optionKey?: string | number
}

export interface TransferAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    getSelected: () => DataItemMap;
    updateSelected: (selectedItems: DataItemMap) => void;
    notifyChange: (values: Array<number | string>, items: Array<BasicDataItem>) => void;
    notifySearch: (input: string) => void;
    notifySelect: (items: BasicDataItem) => void;
    notifyDeselect: (items: BasicDataItem) => void;
    updateInput: (input: string) => void;
    updateSearchResult: (searchResult: Set<number | string>) => void;
    searchTree: (keyword: string) => void
}

export default class TransferFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<TransferAdapter<P, S>> {
    constructor(adapter: TransferAdapter<P, S>) {
        super({ ...adapter });
    }

    _generateGroupedData(dataSource: any[]) {
        return _generateGroupedData(dataSource);
    }

    _generateTreeData(dataSource: any[]) {
        return _generateTreeData(dataSource);
    }

    _generatePath(item: BasicResolvedDataItem) {
        const { path = [] } = item;
        return path.map((p: any) => p.label).join(' > ');
    }

    handleInputChange(inputVal: string, notify: boolean) {
        const { data } = this.getStates();
        const { filter, type } = this.getProps();
        if (type === strings.TYPE_TREE_TO_LIST) {
            const searchResult = new Set(data.map((item: BasicResolvedDataItem) => item.key)) as Set<number | string>;
            this._adapter.searchTree(inputVal);
            notify && this._adapter.notifySearch(inputVal);
            this._adapter.updateInput(inputVal);
            this._adapter.updateSearchResult(searchResult);
            return;
        }
        const filterFunc = typeof filter === 'function' ?
            (item: BasicResolvedDataItem) => filter(inputVal, item) :
            (item: BasicResolvedDataItem) => typeof item.label === 'string' && item.label.includes(inputVal);
        const searchData = data.filter(filterFunc);
        const searchResult = new Set(searchData.map((item: BasicResolvedDataItem) => item.key)) as Set<number | string>;
        notify && this._adapter.notifySearch(inputVal);
        this._adapter.updateInput(inputVal);
        this._adapter.updateSearchResult(searchResult);
    }

    // Select or cancel all unhidden items
    handleAll(wantAllChecked: boolean) {
        const { disabled, type } = this.getProps();
        const { selectedItems, data, searchResult, inputValue } = this.getStates();
        if (disabled) {
            return;
        }
        const inSearchMode = inputValue !== '';
        let operateData = [];
        operateData = inSearchMode ? data.filter((item: BasicResolvedDataItem) => searchResult.has(item.key)) : data;
        operateData = type === strings.TYPE_TREE_TO_LIST ? data : operateData;
        let newSelectedItems = new Map();

        switch (true) {
            case !wantAllChecked:
                newSelectedItems = new Map(selectedItems);
                operateData.forEach((item: BasicResolvedDataItem) => {
                    // If the item is disabled, keep it
                    if (!item.disabled) {
                        newSelectedItems.delete(item.key);
                    }
                });
                break;
            case wantAllChecked:
                newSelectedItems = new Map(selectedItems);
                operateData.forEach((item: BasicResolvedDataItem) => {
                    if (item.disabled) {
                        // The disabled item, judge whether it is selected, if it is selected, still need to add the selection
                        if (selectedItems.has(item.key)) {
                            newSelectedItems.set(item.key, item);
                        }
                        return;
                    }
                    newSelectedItems.set(item.key, item);
                });
                break;
            default:
                break;
        }
        if (!this._isControlledComponent()) {
            this._adapter.updateSelected(newSelectedItems);
        }
        this._notifyChange(newSelectedItems);
    }

    handleClear() {
        const { disabled } = this.getProps();
        const { selectedItems, data } = this.getStates();
        if (disabled) {
            return;
        }
        const newSelectedItems = new Map(selectedItems) as DataItemMap;
        data.forEach((item: BasicResolvedDataItem) => {
            // If the item is disabled, keep it
            if (!item.disabled) {
                newSelectedItems.delete(item.key);
            }
        });
        if (!this._isControlledComponent()) {
            this._adapter.updateSelected(newSelectedItems);
        }
        this._notifyChange(newSelectedItems);
    }

    handleSelectOrRemove(item: BasicResolvedDataItem) {
        const { disabled } = this.getProps();
        const selectedItems = this._adapter.getSelected();
        if (disabled || item.disabled) {
            return;
        }
        if (selectedItems.has(item.key)) {
            selectedItems.delete(item.key);
            this._adapter.notifyDeselect(item);
        } else {
            selectedItems.set(item.key, item);
            this._adapter.notifySelect(item);
        }
        if (!this._isControlledComponent()) {
            this._adapter.updateSelected(selectedItems);
        }
        this._notifyChange(selectedItems);
    }

    handleSelect(values: BasicTreeValue) {
        const { disabled } = this.getProps();
        const selectedItems = this._adapter.getSelected();
        const { data } = this.getStates();
        const dataItems = data.map((d: BasicResolvedDataItem) => [d.value, d]);
        const allItemsMap = new Map(dataItems);
        const nextSelectedItemsMap = new Map();

        if (disabled) {
            return;
        }

        (values as any).forEach((value: any) => {
            const node = allItemsMap.get(value) as BasicResolvedDataItem;
            // The value passed in is an array of the value used, but the internal selectedItems stores a map of keys
            if (selectedItems.has(node.key)) {
                nextSelectedItemsMap.set(node.key, node);
                return;
            }
            if (node.disabled) {
                return;
            }
            nextSelectedItemsMap.set(node.key, node);
            return;
        });

        if (!this._isControlledComponent()) {
            this._adapter.updateSelected(nextSelectedItemsMap);
        }
        this._notifyChange(nextSelectedItemsMap);
    }

    getValuesAndItemsFromMap(selectedItems: DataItemMap) {
        const { type } = this.getProps();
        const items = [];
        const values = [];
        for (const item of selectedItems) {
            const obj = (type === strings.TYPE_GROUP_LIST ? omit(item[1], '_parent') : item[1]) as BasicDataItem;
            items.push(obj);
            values.push(obj.value);
        }
        return { items, values };
    }

    _notifyChange(selectedItems: DataItemMap) {
        const { items, values } = this.getValuesAndItemsFromMap(selectedItems);
        this._adapter.notifyChange(values, items);
    }

    handleSortEnd(callbackProps: OnSortEndProps) {
        const { oldIndex, newIndex } = callbackProps;
        const selectedItems = this._adapter.getSelected();
        let selectedArr = [...selectedItems.values()];
        selectedArr = arrayMove(selectedArr, oldIndex, newIndex);
        let newSelectedItems = new Map();
        selectedArr.forEach(option => {
            newSelectedItems = newSelectedItems.set(option.key, option);
        });
        this._adapter.updateSelected(newSelectedItems);
        this._notifyChange(newSelectedItems);
    }

}
