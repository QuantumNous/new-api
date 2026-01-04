import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import NavItem from './NavItem';
import { ItemProps, ItemKey } from './itemFoundation';
import { strings } from './constants';
import { get } from 'lodash';
import isNullOrUndefined from '../utils/isNullOrUndefined';

export interface ItemKey2ParentKeysMap {
    [key: string]: (string | number)[]
}

export interface OnClickData {
    itemKey: ItemKey;
    domEvent: any;
    isOpen: boolean
}

export interface OnSelectData extends OnClickData {
    selectedKeys: ItemKey[];
    selectedItems: ItemProps[]
}

export interface OnOpenChangeData extends OnClickData {
    openKeys: ItemKey[]
}

export interface NavItemType {
    props?: ItemProps;
    items?: NavItemType[];
    [key: string]: any
}

export interface NavigationAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    notifySelect(data: OnSelectData): void;
    notifyOpenChange(data: OnOpenChangeData): void;
    setIsCollapsed(isCollapsed: boolean): void;
    notifyCollapseChange(isCollapsed: boolean): void;
    updateItems(items: ItemProps[]): void;
    setItemKeysMap(map: { [key: string]: (string | number)[] }): void;
    addSelectedKeys(...keys: (string | number)[]): void;
    removeSelectedKeys(...keys: (string | number)[]): void;
    updateSelectedKeys(keys: (string | number)[], includeParentKeys?: boolean): void;
    updateOpenKeys(keys: (string | number)[]): void;
    addOpenKeys(...keys: (string | number)[]): void;
    removeOpenKeys(...keys: (string | number)[]): void;
    setItemsChanged(isChanged: boolean): void
}

export default class NavigationFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<NavigationAdapter<P, S>, P, S> {
    constructor(adapter: NavigationAdapter<P, S>) {
        super({ ...adapter });
    }

    /* istanbul ignore next */
    static getZeroParentKeys(itemKeysMap = {}, ...itemKeys: ItemKey[]) {
        const willAddKeys = [];
        if (itemKeys.length) {
            for (const itemKey of itemKeys) {
                if (Array.isArray(itemKeysMap[itemKey]) && itemKeysMap[itemKey].length) {
                    const levelZeroParentKey = itemKeysMap[itemKey][0];
                    if (!isNullOrUndefined(levelZeroParentKey)) {
                        willAddKeys.push(levelZeroParentKey);
                    }
                }
            }
        }

        return willAddKeys;
    }

    static buildItemKeysMap(items: NavItemType[] = [], keysMap = {}, parentKeys: (string | number)[] = [], keyPropName = 'itemKey') {
        if (Array.isArray(items) && items.length) {
            for (const item of items) {
                if (Array.isArray(item)) {
                    NavigationFoundation.buildItemKeysMap(item, keysMap, [...parentKeys], keyPropName);
                } else {
                    let itemKey;
                    if (item && typeof item === 'object') {
                        itemKey = item[keyPropName] || (item.props && item.props[keyPropName]);
                    }
                    if (itemKey) {
                        keysMap[itemKey] = [...parentKeys];
                        // Children is not a recommended usage and may cause some bug-like performance, but some users have already used it, so here we only delete the ts definition instead of deleting the actual code
                        // children 并不是我们推荐的用法，可能会导致一些像 bug的表现，但是有些用户已经用了，所以此处仅作删除 ts 定义而非删除实际代码的操作
                        // refer https://github.com/DouyinFE/semi-design/issues/2710
                        // @ts-ignore  
                        const itemChildren = item.props?.children;

                        if (Array.isArray(item.items) && item.items.length) {
                            NavigationFoundation.buildItemKeysMap(
                                item.items,
                                keysMap,
                                [...parentKeys, itemKey],
                                keyPropName
                            );  
                        } else if (itemChildren) { 
                            const children = Array.isArray(itemChildren) 
                                ? itemChildren
                                : [itemChildren];
                            NavigationFoundation.buildItemKeysMap(
                                children,
                                keysMap,
                                [...parentKeys, itemKey],
                                keyPropName
                            );
                        }
                    }
                }
            }
        }

        return keysMap;
    }

    /**
     * init is called in constructor and componentDidMount.
     * if you want to update state in constructor, please add it to return object;
     * if you want to update state in componentDidMount, please call adapter in else logic.
     * @param {*} lifecycle
     * @returns
     */
    init(lifecycle?: string) {
        const { defaultSelectedKeys, selectedKeys } = this.getProps();
        let willSelectedKeys = selectedKeys || defaultSelectedKeys || [];
        const { itemKeysMap, willOpenKeys, formattedItems } = this.getCalcState();
        const parentSelectKeys = this.selectLevelZeroParentKeys(itemKeysMap, willSelectedKeys);
        willSelectedKeys = willSelectedKeys.concat(parentSelectKeys);

        if (lifecycle === 'constructor') {
            return {
                selectedKeys: willSelectedKeys,
                itemKeysMap,
                openKeys: willOpenKeys,
                items: formattedItems,
            };
        } else {
            // already include parentSelectKeys, set second parameter to false
            this._adapter.updateSelectedKeys(willSelectedKeys, false);
            this._adapter.setItemKeysMap(itemKeysMap);
            this._adapter.updateOpenKeys(willOpenKeys);
            this._adapter.updateItems(formattedItems);
            this._adapter.setItemsChanged(true);
        }
        return undefined;
    }

    /**
     * Get the state to be calculated
     */
    getCalcState() {
        const { itemKeysMap, formattedItems } = this.getFormattedItems();
        const willOpenKeys = this.getWillOpenKeys(itemKeysMap);
        return { itemKeysMap, willOpenKeys, formattedItems };
    }

    /**
     * Calculate formatted items and itemsKeyMap
     */
    getFormattedItems() {
        const { items, children } = this.getProps();
        const formattedItems = this.formatItems(items);
        const willHandleItems = Array.isArray(items) && items.length ? formattedItems : children;
        const itemKeysMap = NavigationFoundation.buildItemKeysMap(willHandleItems);
        return {
            itemKeysMap,
            formattedItems
        };
    }

    /**
     * Calculate the keys that will need to be opened soon
     * @param {*} itemKeysMap
     */
    getWillOpenKeys(itemKeysMap: ItemKey2ParentKeysMap) {
        const { defaultOpenKeys, openKeys, defaultSelectedKeys, selectedKeys, mode } = this.getProps();
        const { openKeys: stateOpenKeys = [] } = this.getStates();

        let willOpenKeys = openKeys || defaultOpenKeys || [];
        if (
            !(Array.isArray(defaultOpenKeys) ||
            Array.isArray(openKeys)) && mode === strings.MODE_VERTICAL && (Array.isArray(defaultSelectedKeys) || Array.isArray(selectedKeys))
        ) {
            const currentSelectedKeys = Array.isArray(selectedKeys) ? selectedKeys : defaultSelectedKeys;
            willOpenKeys = stateOpenKeys.concat(this.getShouldOpenKeys(itemKeysMap, currentSelectedKeys));
            willOpenKeys = Array.from(new Set(willOpenKeys));
        }
        return [...willOpenKeys];
    }

    getShouldOpenKeys(itemKeysMap: ItemKey2ParentKeysMap = {}, selectedKeys: ItemKey[] = []) {
        const willOpenKeySet = new Set();

        if (Array.isArray(selectedKeys) && selectedKeys.length) {
            selectedKeys.forEach(item => {
                if (item) {
                    const parentKeys = get(itemKeysMap, item);

                    if (Array.isArray(parentKeys)) {
                        parentKeys.forEach(k => willOpenKeySet.add(k));
                    }
                }
            });
        }

        return [...willOpenKeySet];
    }

    destroy() {}

    selectLevelZeroParentKeys(itemKeysMap: ItemKey2ParentKeysMap, itemKeys: ItemKey[]) {
        const _itemKeysMap = isNullOrUndefined(itemKeysMap) ? this.getState('itemKeysMap') : itemKeysMap;
        // console.log(itemKeysMap);

        const willAddKeys = [];
        if (itemKeys.length) {
            for (const itemKey of itemKeys) {
                if (Array.isArray(_itemKeysMap[itemKey]) && _itemKeysMap[itemKey].length) {
                    const levelZeroParentKey = _itemKeysMap[itemKey][0];
                    if (!isNullOrUndefined(levelZeroParentKey)) {
                        willAddKeys.push(levelZeroParentKey);
                    }
                }
            }
        }
        if (willAddKeys.length) {
            return willAddKeys;
        }
        return [];
    }

    formatItems(items: ItemProps[] = []) {
        const formattedItems = [];
        for (const item of items) {
            formattedItems.push(new NavItem(item));
        }
        return formattedItems;
    }

    handleSelect(data: OnSelectData) {
        this._adapter.notifySelect(data);
    }

    /* istanbul ignore next */
    judgeIfOpen(openKeys: ItemKey[], items: NavItemType[]): boolean {
        let shouldBeOpen = false;

        const _openKeys = Array.isArray(openKeys) ? openKeys : openKeys && [openKeys];

        if (_openKeys && Array.isArray(items) && items.length) {
            for (const item of items) {
                shouldBeOpen = _openKeys.includes(item.itemKey) || this.judgeIfOpen(_openKeys, item.items);
                if (shouldBeOpen) {
                    break;
                }
            }
        }

        return shouldBeOpen;
    }

    handleCollapseChange() {
        const isCollapsed = !this.getState('isCollapsed');

        if (!this._isControlledComponent('isCollapsed')) {
            this._adapter.setIsCollapsed(isCollapsed);
        }
        this._adapter.notifyCollapseChange(isCollapsed);
    }

    handleItemsChange(isChanged: boolean) {
        this._adapter.setItemsChanged(isChanged);
    }
}
