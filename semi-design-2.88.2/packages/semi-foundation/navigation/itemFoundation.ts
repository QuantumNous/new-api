/* argus-disable unPkgSensitiveInfo */
import { get } from 'lodash';
import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import isEnterPress from '../utils/isEnterPress';

export interface ItemProps {
    text?: any;
    itemKey?: any;
    icon?: any;
    toggleIcon?: string;
    indent?: boolean | number;
    isCollapsed?: boolean;
    isSubNav?: boolean;
    link?: string;
    linkOptions?: Record<string, any>;
    disabled?: boolean
}

export type ItemKey = string | number;

export interface SelectedItemProps<Props = ItemProps> {
    itemKey: ItemKey;
    text?: any;
    selectedKeys?: ItemKey[];
    selectedItems?: Props[];
    domEvent?: any
}

export interface ItemAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    cloneDeep(value: any, customizer?: (value: any) => void): any;
    updateTooltipShow(showTooltip: boolean): void;
    updateSelected(selected: boolean): void;
    updateGlobalSelectedKeys(keys: ItemKey[]): void;
    getSelectedKeys(): ItemKey[];
    getSelectedKeysIsControlled(): boolean;
    notifyGlobalOnSelect(item: SelectedItemProps): void;
    notifyGlobalOnClick(item: SelectedItemProps): void;
    notifyClick(item: SelectedItemProps): void;
    notifyMouseEnter(e: any): void;
    notifyMouseLeave(e: any): void;
    getIsCollapsed(): boolean;
    getSelected(): boolean;
    getIsOpen(): boolean
}

export default class ItemFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<ItemAdapter<P, S>, P, S> {

    _timer: number;
    _mounted: boolean;
    constructor(adapter: ItemAdapter<P, S>) {
        super({ ...adapter });
    }

    init() {
        this._timer = null;
        this._mounted = true;
    }

    destroy() {
        this._mounted = false;
    }

    isValidKey(itemKey: string) {
        return itemKey != null && (typeof itemKey === 'string' || typeof itemKey === 'number');
    }

    handleClick(e: any) {
        const { isSubNav, itemKey, text, disabled } = this.getProps();

        if (disabled) {
            return;
        }

        if (
            !isSubNav &&
            this.isValidKey(itemKey) &&
            !this._adapter.getSelectedKeysIsControlled() &&
            !this._adapter.getSelected()
        ) {
            this._adapter.updateSelected(true);
        }

        const selectedKeys = [itemKey];

        // If the current item is subNav, there is no need to trigger the global onSelect/onClick event, instead, the SubNav component will trigger the click event
        if (!isSubNav) {
            if (!this._adapter.getSelected()) {
                // internal-issues:51
                const selectedItems = [this._adapter.cloneDeep(this.getProps())];

                this._adapter.notifyGlobalOnSelect({ itemKey, selectedKeys, selectedItems, domEvent: e });
            }
            this._adapter.notifyGlobalOnClick({ itemKey, text, domEvent: e });
        }
        this._adapter.notifyClick({ itemKey, text, domEvent: e });
    }

    /**
     * A11y: simulate item click
     */
    handleKeyPress(e: any) {
        if (isEnterPress(e)) {
            const { link, linkOptions } = this.getProps();
            const target = get(linkOptions, 'target', '_self');
            this.handleClick(e);
            if (typeof link === 'string') {
                target === '_blank' ? window.open(link) : window.location.href = link;
            }
        }
    }
}
