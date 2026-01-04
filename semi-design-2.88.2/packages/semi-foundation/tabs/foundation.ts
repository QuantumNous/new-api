import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { get, noop } from 'lodash';

export interface TabsAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    collectPane: () => void;
    collectActiveKey: () => void;
    notifyTabClick: (activeKey: string, event: any) => void;
    notifyChange: (activeKey: string) => void;
    setNewActiveKey: (activeKey: string) => void;
    getDefaultActiveKeyFromChildren: () => string;
    notifyTabDelete: (tabKey: string) => void
}

class TabsFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<TabsAdapter<P, S>, P, S> {
    constructor(adapter: TabsAdapter<P, S>) {
        super({ ...adapter });
    }

    init(): void {
        this._adapter.collectPane();
    }

    destroy = noop;

    _notifyChange(activeKey: string): void {
        const { activeKey: stateActiveKey } = this.getStates();
        if (stateActiveKey !== activeKey) {
            this._adapter.notifyChange(activeKey);
        }
    }

    handleTabClick(activeKey: string, event: any): void {
        const isControlledComponent = this._isInProps('activeKey');
        if (isControlledComponent) {
            this._notifyChange(activeKey);
        } else {
            this._notifyChange(activeKey);
            this.handleNewActiveKey(activeKey);
        }
        this._adapter.notifyTabClick(activeKey, event);
    }

    handleNewActiveKey(activeKey: string): void {
        const { activeKey: stateActiveKey } = this.getStates();
        if (stateActiveKey !== activeKey) {
            this._adapter.setNewActiveKey(activeKey);
        }
    }

    getDefaultActiveKey(): string {
        let activeKey;
        const props = this.getProps();
        if ('activeKey' in props) {
            activeKey = props.activeKey;
        } else if ('defaultActiveKey' in props) {
            activeKey = props.defaultActiveKey;
        } else {
            activeKey = this._adapter.getDefaultActiveKeyFromChildren();
        }
        return activeKey;
    }

    handleTabListChange(): void {
        this._adapter.collectPane();
    }

    handleTabPanesChange(): void {
        this._adapter.collectPane();
        this._adapter.collectActiveKey();
    }

    handleTabDelete(tabKey: string): void {
        this._adapter.notifyTabDelete(tabKey);
    }

    handlePrevent = (event: any) => {
        event.stopPropagation();
        event.preventDefault();
    }

    handleKeyDown = (event: any, itemKey: string, closable: boolean) => {
        const { preventScroll } = this.getProps();
        const tabs = [...event.target.parentNode.childNodes].filter(item => {
            return get(item, 'attributes.data-tabkey.value', '').includes('semiTab') && get(item, 'attributes.aria-disabled.value', '') !== "true";
        });

        switch (event.key) {
            case "ArrowLeft":
            case "ArrowRight":
            case "ArrowUp":
            case "ArrowDown":
                this.determineOrientation(event, tabs);
                break;
            case "Backspace":
            case "Delete":
                this.handleDeleteKeyDown(event, tabs, itemKey, closable);
                break;
            case "Enter":
            case " ":
                this.handleTabClick(itemKey, event);
                this.handlePrevent(event);
                break;
            case "Home":
                tabs[0].focus({ preventScroll }); // focus first tab
                this.handlePrevent(event);
                break;
            case "End":
                tabs[tabs.length - 1].focus({ preventScroll }); // focus last tab
                this.handlePrevent(event);
                break;
        }
    }

    determineOrientation(event: any, tabs: HTMLElement[]): void {
        const { tabPosition } = this.getProps();
        const isVertical = tabPosition === 'left';

        if (isVertical) {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                this.switchTabOnArrowPress(event, tabs);
                this.handlePrevent(event);
            }
        } else {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                this.switchTabOnArrowPress(event, tabs);
                this.handlePrevent(event);
            }
        }
    }

    handleDeleteKeyDown(event: any, tabs: HTMLElement[], itemKey: string, closable: boolean): void {
        const { preventScroll } = this.getProps();
        if (closable) {
            this.handleTabDelete(itemKey);
            const index = tabs.indexOf(event.target);
            // Move focus to next element after deletion
            // If the element is the last removable tab, focus to its previous tab
            if (tabs.length !== 1 ) {
                tabs[index + 1 >= tabs.length ? index - 1 : index + 1].focus({ preventScroll });
            }
        }
    }

    switchTabOnArrowPress(event: any, tabs: HTMLElement[]): void {
        const { preventScroll } = this.getProps();
        const index = tabs.indexOf(event.target);

        const direction = {
            "ArrowLeft": -1,
            "ArrowUp": -1,
            "ArrowRight": 1,
            "ArrowDown": 1,
        };

        if (direction[event.key]) {
            if (index !== undefined) {
                if (tabs[index + direction[event.key]]) {
                    tabs[index+ direction[event.key]].focus({ preventScroll });
                } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                    tabs[tabs.length - 1].focus({ preventScroll }); // focus last tab
                } else if (event.key === "ArrowRight" || event.key == "ArrowDown") {
                    tabs[0].focus({ preventScroll }); // focus first tab
                }
            }
        }
    }
}

export default TabsFoundation;
