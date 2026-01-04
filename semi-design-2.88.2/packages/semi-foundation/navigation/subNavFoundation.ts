import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import isEnterPress from '../utils/isEnterPress';

const addKeys = function addKeys(originKeys: (string | number)[] = [], ...willAddKeys: (string | number)[]) {
    const keySet = new Set(originKeys);
    willAddKeys.forEach(key => key && keySet.add(key));
    return Array.from(keySet);
};

const removeKeys = function removeKeys(originKeys: (string | number)[] = [], ...willRemoveKeys: (string | number)[]) {
    const keySet = new Set(originKeys);
    willRemoveKeys.forEach(key => key && keySet.delete(key));
    return Array.from(keySet);
};

export interface OnOpenChangeData {
    itemKey: string | number;
    openKeys: (string | number)[];
    isOpen: boolean
}

export interface OnClickData extends OnOpenChangeData {
    domEvent: any
}

export interface OnSelectData extends OnOpenChangeData {
    domEvent: any
}

export interface SubNavAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    updateIsHovered(isHovered: boolean): void;
    getOpenKeys(): (string | number)[];
    getOpenKeysIsControlled(): boolean;
    getCanUpdateOpenKeys(): boolean;
    updateOpen(isOpen: boolean): void;
    notifyGlobalOpenChange(data: OnOpenChangeData): void;
    notifyGlobalOnSelect(data: OnSelectData): void;
    notifyGlobalOnClick(data: OnClickData): void;
    getIsSelected(itemKey: string | number): boolean;
    getIsOpen(): boolean
}

export default class SubNavFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<SubNavAdapter<P, S>, P, S> {
    constructor(adapter: SubNavAdapter<P, S>) {
        super({ ...adapter });
    }

    _timer: number;

    init() {
        // this.log('invoke SubNavFoundation init()');
        this._timer = null;
    }

    destroy() {
        this.clearDelayTimer();
    }

    clearDelayTimer() {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    }

    isValidKey(itemKey: string | number) {
        return itemKey != null && (typeof itemKey === 'number' || typeof itemKey === 'string');
    }

    handleDropdownVisibleChange(visible: boolean) {
        const itemKey = this.getProp('itemKey');

        const openKeysIsControlled = this._adapter.getOpenKeysIsControlled();
        const canUpdateOpenKeys = this._adapter.getCanUpdateOpenKeys();
        const rawOpenKeys = this._adapter.getOpenKeys();

        const openKeys = visible ? addKeys(rawOpenKeys, itemKey) : removeKeys(rawOpenKeys, itemKey);

        this.clearDelayTimer();

        if (!openKeysIsControlled) {
            if (canUpdateOpenKeys) {
                this._adapter.updateOpen(visible);
            }
            // this._adapter.updateIsHovered(visible);
        }

        this._adapter.notifyGlobalOpenChange({ itemKey, openKeys, isOpen: visible });
    }

    /**
     *
     * @param {Event} e
     * @param {HTMLElement} titleRef
     */
    handleClick(e: any, titleRef: any) {
        const { itemKey, disabled } = this.getProps();
        if (disabled) {
            return;
        }
        // this.log(e, titleRef, titleRef.contains(e.target));
        const clickedDomIsTitle = titleRef && titleRef.contains(e.target);
        let isOpen = Boolean(this._adapter.getIsOpen());
        if (!clickedDomIsTitle) {
            isOpen = false;
        } else {
            isOpen = !isOpen;
        }

        const openKeys = isOpen
            ? addKeys(this._adapter.getOpenKeys(), itemKey)
            : removeKeys(this._adapter.getOpenKeys(), itemKey);

        const cbVal = { itemKey, openKeys, isOpen, domEvent: e };

        const openKeysIsControlled = this._adapter.getOpenKeysIsControlled();
        const canUpdateOpenKeys = this._adapter.getCanUpdateOpenKeys();

        if (!openKeysIsControlled && canUpdateOpenKeys) {
            this._adapter.updateOpen(isOpen);
        }
        this._adapter.notifyGlobalOpenChange(cbVal);
        this._adapter.notifyGlobalOnClick(cbVal);
    }

    /**
     * A11y: simulate sub nav click
     * @param e 
     * @param titleRef 
     */
    handleKeyPress(e: any, titleRef: any) {
        if (isEnterPress(e)) {
            this.handleClick(e, titleRef);
        }
    }
}
