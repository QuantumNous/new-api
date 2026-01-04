import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { Motion } from '../utils/type';

export type ArgsType<T> = T extends (...args: infer A) => any ? A : never;

export interface CollapseProps{
    activeKey?: string | string[];
    defaultActiveKey?: string | string[];
    accordion?: boolean;
    clickHeaderToExpand?: boolean;
    onChange?: (activeKey: CollapseProps['activeKey'], e: any) => void;
    expandIcon?: any;
    collapseIcon?: any;
    style?: any;
    className?: string;
    keepDOM?: boolean;
    motion?: boolean;
    expandIconPosition?: 'left' | 'right'

}

export interface CollapseState{
    activeSet: Set<string>
}

export interface CollapseAdapter extends DefaultAdapter<CollapseProps, CollapseState>{
    handleChange: (activeKey: CollapseProps['activeKey'], e: any) => void;
    // getStates: () => CollapseState;
    // getProps: () => CollapseProps;
    addActiveKey: (newSet: CollapseState['activeSet']) => void
}

export default class CollapseFoundation extends BaseFoundation<CollapseAdapter> {

    constructor(adapter: CollapseAdapter) {
        super({
            ...adapter
        });
    }
    initActiveKey() {
        const {
            defaultActiveKey,
            activeKey,
            accordion
        } = this.getProps();
        let activeKeyList = activeKey ? activeKey : defaultActiveKey;
        if (accordion) {
            activeKeyList = Array.isArray(activeKeyList) ? activeKeyList[0] : activeKeyList;
        }
        if (activeKeyList && activeKeyList.length) {
            activeKeyList = Array.isArray(activeKeyList) ? activeKeyList : [activeKeyList];
            return activeKeyList;
        }
        return [];
        // this._adapter.initActiveSet(activeKeyList);
    }

    handleChange(newKey: string, e: any) {
        const {
            activeKey,
            accordion
        } = this.getProps();
        const {
            activeSet
        } = this.getStates();
        let newSet = new Set(activeSet) as CollapseState['activeSet'];
        if (newSet.has(newKey)) {
            newSet.delete(newKey);
        } else {
            if (accordion) {
                newSet = new Set([newKey]);
            } else {
                newSet.add(newKey);
            }
        }
        this._adapter.handleChange([...newSet.values()], e);
        if (typeof activeKey === 'undefined') {
            this._adapter.addActiveKey(newSet);
        }
    }
}