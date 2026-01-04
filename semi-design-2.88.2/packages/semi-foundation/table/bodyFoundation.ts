import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { get, includes, isMap, findLastIndex, isObject } from 'lodash';
import { strings } from './constants';
import { getRecordKey, genExpandedRowKey, getRecordChildren, expandBtnShouldInRow } from './utils';

export interface BodyAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    setVirtualizedData: (virtualizedData: any[], cb: () => void) => void;
    setCachedExpandBtnShouldInRow: (cachedExpandBtnShouldInRow: boolean) => void;
    setCachedExpandRelatedProps: (cachedExpandRelatedProps: string[]) => void;
    observeBodyResize: (bodyWrapDOM: any) => void;
    unobserveBodyResize: () => void
}

export default class TableBodyFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<BodyAdapter<P, S>, P, S> {
    init() {
        this.initVirtualizedData();
        this.initExpandBtnShouldInRow();
    }

    destroy() {
        this.unobserveBodyResize();
    }

    initVirtualizedData(cb?: (...args: any[]) => void) {
        this._adapter.setVirtualizedData(this.flattenData(this.getProp('dataSource')), cb);
    }

    initExpandBtnShouldInRow(newExpandRelatedProps?: any[]) {
        const props = this.getProps(); // TODO check: this._adapter.getProps -> this.getProps
        const cachedExpandBtnShouldInRow = expandBtnShouldInRow(props);
        this._adapter.setCachedExpandBtnShouldInRow(cachedExpandBtnShouldInRow);

        if (!isObject(newExpandRelatedProps) && !newExpandRelatedProps) {
            const expandRelatedProps = strings.EXPAND_RELATED_PROPS;
            newExpandRelatedProps = expandRelatedProps.map(key => get(props, key, undefined));
        }
        this._adapter.setCachedExpandRelatedProps(newExpandRelatedProps);
    }

    flattenData(dataSource: any[] = [], level = 0, parentKeys: any[] = [], childrenKeys: any[] = []) {
        const flattenData: Array<FlattenData | GroupFlattenData> = [];
        const { rowKey, childrenRecordName, expandedRowRender, expandedRowKeys, groups } = this.getProps();

        if (level === 0 && isMap(groups)) {
            groups.forEach((set, key) => {
                const firstIndex = dataSource.findIndex(record => set.has(getRecordKey(record, rowKey)));

                if (firstIndex > -1) {
                    const lastIndex = findLastIndex(dataSource, record => set.has(getRecordKey(record, rowKey)));
                    const expanded = includes(expandedRowKeys, key);
                    flattenData.push({
                        key,
                        level,
                        sectionRow: true,
                        group: set,
                        groupKey: key,
                        expanded,
                    });

                    if (expanded) {
                        flattenData.push(
                            ...this.flattenData(
                                dataSource.slice(firstIndex, lastIndex + 1),
                                level + 1,
                                [...parentKeys],
                                [...childrenKeys]
                            )
                        );
                    }
                }
            });
        } else {
            dataSource.forEach((record, index) => {
                const recordKey = getRecordKey(record, rowKey);
                const children = getRecordChildren(record, childrenRecordName);
                if (level) {
                    childrenKeys.push(recordKey);
                }
                const item = {
                    key: recordKey,
                    record,
                    level,
                    parentKeys: [...parentKeys],
                    childrenKeys: [...childrenKeys],
                };
                flattenData.push(item);

                const extras = [];
                if (includes(expandedRowKeys, recordKey)) {
                    if (Array.isArray(children) && children.length) {
                        extras.push(
                            ...this.flattenData(children, level + 1, [...item.parentKeys], [...item.childrenKeys])
                        );
                    } else if (expandedRowRender) {
                        extras.push({
                            key: genExpandedRowKey(recordKey),
                            level,
                            expandedRow: true,
                            record,
                        });
                    }
                    flattenData.push(...extras);
                }
            });
        }

        return flattenData;
    }

    /**
     * Use ResizeObserver to monitor changes in the size of the body content area, and notify Table to recalculate if it changes. columns #1219
     * (Only monitor the scroll.y scene, other scenes are not monitored, because the header of the scroll.y scene is a separate table, and a scrollbar column will be inserted)
     */
    observeBodyResize(bodyDOM: any) {
        const { scroll } = this.getProps(); // TODO check: this._adapter.getProps -> this.getProps
        if (get(scroll, 'y')) {
            return this._adapter.observeBodyResize(bodyDOM);
        }
    }

    unobserveBodyResize() {
        return this._adapter.unobserveBodyResize();
    }
}

export interface GroupFlattenData {
    key: number | string;
    level: number;
    sectionRow: boolean;
    group: Map<string, Record<string, any>[]>;
    groupKey: number;
    expanded: boolean
}

export interface FlattenData {
    key: number | string;
    record: Record<string, any>;
    level: number;
    parentKeys?: any[];
    childrenKeys?: any[];
    expandedRow?: boolean;
    sectionRow?: boolean
}
