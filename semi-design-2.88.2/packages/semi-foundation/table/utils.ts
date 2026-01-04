import {
    isEqualWith,
    get,
    filter,
    find,
    map,
    clone as lodashClone,
    each,
    findIndex,
    some,
    includes,
    toString,
    isFunction
} from 'lodash';
import { strings, numbers } from './constants';
import isNullOrUndefined from '../utils/isNullOrUndefined';
import Logger from '../utils/Logger';
import type { BaseEllipsis } from './foundation';


export function equalWith(value: any, other: any, customizer?: (...args: any[]) => boolean) {
    return isEqualWith(value, other, (objVal, othVal, ...rest) => {
        if (typeof objVal === 'function' && typeof othVal === 'function') {
            return toString(objVal) === toString(othVal);
        }

        if (typeof customizer === 'function') {
            return customizer(objVal, othVal, ...rest);
        }
        // If customizer returns undefined, comparisons are handled by isEqual instead
        return undefined;
    });
}

export function getColumnKey(column: any, keyPropNames: any[]): any {
    keyPropNames = Array.isArray(keyPropNames) ? keyPropNames : ['key', 'dataIndex'];
    let key = null;
    each(keyPropNames, propName => {
        key = get(column, propName);

        if (key != null) {
            return false;
        }
        return undefined;
    });

    return key;
}

/**
 *
 * @param {Array<number>} arr
 * @param {number} [beginIndex] begin index, included
 * @param {number} [endIndex] end index, not included
 * @returns {number}
 */
export function arrayAdd(arr: any[] = [], beginIndex = 0, endIndex?: number) {
    beginIndex = beginIndex < 0 || typeof beginIndex !== 'number' ? 0 : beginIndex;
    endIndex = endIndex > arr.length || typeof endIndex !== 'number' ? arr.length : endIndex;

    let result = 0;
    each(arr, (value, index) => {
        if (index >= beginIndex && index < endIndex) {
            result += typeof value === 'number' && !isNaN(value) ? value : 0;
        }
    });

    return result;
}

export function isLastLeftFixed(columns: Record<string, any>[], column: Record<string, any>, checkKeys = ['key']) {
    const leftFixedColumns = filter(columns, col => col.fixed === true || col.fixed === 'left');
    const index = findIndex(leftFixedColumns, col =>
        checkKeys.every(key => col[key] != null && col[key] === column[key])
    );
    return leftFixedColumns.length > 0 && index === leftFixedColumns.length - 1;
}

export function isFirstFixedRight(columns: Record<string, any>[], column: Record<string, any>, checkKeys = ['key']) {
    const rightFixedColumns = filter(columns, col => col.fixed === 'right');
    const index = findIndex(rightFixedColumns, col =>
        checkKeys.every(key => col[key] != null && col[key] === column[key])
    );
    return rightFixedColumns.length > 0 && index === 0;
}

export function isAnyFixed(columns: Record<string, any>[], fixedSet = ['left', true, 'right']) {
    if (typeof fixedSet === 'string' || typeof fixedSet === 'boolean') {
        fixedSet = [fixedSet];
    }
    return fixedSet.length > 0 && some(columns, col => fixedSet.includes(col.fixed));
}

export function isAnyFixedRight(columns: Record<string, any>[]) {
    return some(columns, col => col.fixed === 'right');
}

export function isFixedLeft(column: Record<string, any>) {
    return ['left', true].includes(get(column, 'fixed'));
}

export function isFixedRight(column: Record<string, any>) {
    return ['right'].includes(get(column, 'fixed'));
}

export function isFixed(column: Record<string, any>) {
    return isFixedLeft(column) || isFixedRight(column);
}

export function isInnerColumnKey(key: string | number) {
    return [
        strings.DEFAULT_KEY_COLUMN_EXPAND,
        strings.DEFAULT_KEY_COLUMN_SCROLLBAR,
        strings.DEFAULT_KEY_COLUMN_SELECTION,
    ].includes(key as any);
}

export function isExpandedColumn(column: Record<string, any>) {
    return get(column, 'key') === strings.DEFAULT_KEY_COLUMN_EXPAND;
}

export function isScrollbarColumn(column: Record<string, any>) {
    return get(column, 'key') === strings.DEFAULT_KEY_COLUMN_SCROLLBAR;
}

export function isSelectionColumn(column: Record<string, any>) {
    return get(column, 'key') === strings.DEFAULT_KEY_COLUMN_SELECTION;
}

export function filterColumns(columns: Record<string, any>[], ignoreKeys = [strings.DEFAULT_KEY_COLUMN_SCROLLBAR as string]) {
    return filter(columns, col => !ignoreKeys.includes(col.key));
}

/**
 * get width of scroll bar
 * @param {Array} columns
 * @returns {Number|undefined}
 */
export function getScrollbarColumnWidth(columns: Record<string, any>[] = []) {
    const len = columns.length;
    if (len) {
        const lastColumn = columns[len - 1];
        if (get(lastColumn, 'key') === strings.DEFAULT_KEY_COLUMN_SCROLLBAR) {
            return get(lastColumn, 'width', 0);
        }
    }
}

export function getRecordKey(record: Record<string, any>, rowKey: string | number | ((record: any) => string | number)) {
    if (rowKey === undefined) {
        rowKey = 'key';
    }
    return typeof rowKey === 'function' ? rowKey(record) : get(record, rowKey);
}

/**
 * Determine whether the expandedRowKeys includes a key (rowKey will be added to expandedRowKeys when the expand button is clicked)
 * @param {*} expandedRowKeys
 * @param {*} key
 */
export function isExpanded(expandedRowKeys: (string | number)[], key: string | number) {
    return key != null && includes(expandedRowKeys, key);
}

/**
 * Determine whether the selectedKeysSet includes the key
 * @param {Set} selectedRowKeysSet
 * @param {String} key
 */
export function isSelected(selectedRowKeysSet: Set<string | number>, key: string | number) {
    return key !== null && selectedRowKeysSet.has(key);
}

/**
 * Whether the key is included in the disabledRowKeysSet
 * @param {Set} disabledRowKeysSet
 * @param {String} key
 */
export function isDisabled(disabledRowKeysSet: Set<string | number>, key: string | number) {
    return key !== null && disabledRowKeysSet.has(key);
}

export function getRecord(data: any[], recordKey: string | number, rowKey: string | number | ((record: any) => string | number)) {
    if (rowKey === undefined) {
        rowKey = 'key';
    }
    return find(data, record => recordKey != null && recordKey !== '' && getRecordKey(record, rowKey) === recordKey);
}

export function getRecordChildren(record: Record<string, any>, childrenRecordName: string) {
    if (childrenRecordName === undefined) {
        childrenRecordName = 'children';
    }
    return get(record, childrenRecordName);
}

export function genExpandedRowKey(recordKey = '', suffix?: string) {
    if (suffix === undefined) {
        suffix = '__expanded_row';
    }
    return recordKey + suffix;
}

export function getDefaultVirtualizedRowConfig(size = '', sectionRow = false) {
    const config: { height?: number; minHeight?: number } = {};
    if (size === 'small') {
        config.height = sectionRow ?
            numbers.DEFAULT_VIRTUALIZED_SECTION_ROW_SMALL_HEIGHT :
            numbers.DEFAULT_VIRTUALIZED_ROW_SMALL_HEIGHT;
        config.minHeight = numbers.DEFAULT_VIRTUALIZED_ROW_SMALL_MIN_HEIGHT;
    } else if (size === 'middle') {
        config.height = sectionRow ?
            numbers.DEFAULT_VIRTUALIZED_SECTION_ROW_MIDDLE_HEIGHT :
            numbers.DEFAULT_VIRTUALIZED_ROW_MIDDLE_HEIGHT;
        config.minHeight = numbers.DEFAULT_VIRTUALIZED_ROW_MIDDLE_MIN_HEIGHT;
    } else {
        config.height = sectionRow ?
            numbers.DEFAULT_VIRTUALIZED_SECTION_ROW_HEIGHT :
            numbers.DEFAULT_VIRTUALIZED_ROW_HEIGHT;
        config.minHeight = numbers.DEFAULT_VIRTUALIZED_ROW_MIN_HEIGHT;
    }
    return config;
}

export function flattenColumns(cols: Record<string, any>[], childrenColumnName = 'children'): Record<string, any>[] {
    const list = [];
    if (Array.isArray(cols) && cols.length) {
        for (const col of cols) {
            if (Array.isArray(col[childrenColumnName]) && col[childrenColumnName].length) {
                list.push(...flattenColumns(col[childrenColumnName], childrenColumnName));
            } else {
                warnIfNoDataIndex(col);
                list.push(col);
            }
        }
    }

    return list;
}

export function assignColumnKeys(columns: Record<string, any>[], childrenColumnName = 'children', level = 0) {
    const sameLevelCols: Record<string, any>[] = [];
    each(columns, (column, index) => {
        if (column.key == null) {
            // if user give column a dataIndex, use it for backup
            const _index = column.dataIndex || index;
            column.key = `${level}-${_index}`;
        }
        if (Array.isArray(column[childrenColumnName]) && column[childrenColumnName].length) {
            sameLevelCols.push(...column[childrenColumnName]);
        }
    });
    if (sameLevelCols.length) {
        assignColumnKeys(sameLevelCols, childrenColumnName, level + 1);
    }
    return columns;
}

export function sliceColumnsByLevel(columns: any[], targetLevel = 0, childrenColumnName = 'children', currentLevel = 0) {
    const slicedColumns: any[] = [];
    if (Array.isArray(columns) && columns.length && currentLevel <= targetLevel) {
        columns.forEach(column => {
            const children = column[childrenColumnName];
            if (Array.isArray(children) && children.length && currentLevel < targetLevel) {
                slicedColumns.push(...sliceColumnsByLevel(children, targetLevel, childrenColumnName, currentLevel + 1));
            } else {
                slicedColumns.push(column);
            }
        });
    }
    return slicedColumns;
}

export function getColumnsByLevel(
    columns: Record<string, any>[],
    targetLevel = 0,
    targetColumns: Record<string, any>[] = [],
    currentLevel = 0,
    childrenColumnName = 'children'
) {
    if (Array.isArray(columns) && columns.length) {
        if (targetLevel === currentLevel) {
            targetColumns.push(...columns);
        } else {
            columns.forEach(column => {
                getColumnsByLevel(
                    column[childrenColumnName],
                    targetLevel,
                    targetColumns,
                    currentLevel + 1,
                    childrenColumnName
                );
            });
        }
    }
    return targetColumns;
}

export function getAllLevelColumns(columns: Record<string, any>[], childrenColumnName = 'children') {
    const all = [];
    if (Array.isArray(columns) && columns.length) {
        all.push([...columns]);
        const sameLevelColumns: Record<string, any>[] = [];
        columns.forEach(column => {
            const children = column[childrenColumnName];
            if (Array.isArray(children) && children.length) {
                sameLevelColumns.push(...children);
            }
        });
        if (sameLevelColumns.length) {
            all.push(sameLevelColumns);
        }
    }
    return all;
}

export function getColumnByLevelIndex(columns: Record<string, any>[], index: number, level = 0, childrenColumnName = 'children') {
    const allLevelColumns = getAllLevelColumns(columns, childrenColumnName);
    return allLevelColumns[level][index];
}

export function findColumn(columns: Record<string, any>[], column: Record<string, any>, childrenColumnName = 'children') {
    let found: any;
    each(columns, item => {
        if (item && item.key != null && !found) {
            if (item.key === column.key) {
                found = item;
            }
        }
        if (item && Array.isArray(item[childrenColumnName]) && !found) {
            found = findColumn(item[childrenColumnName], column, childrenColumnName);
        }

        if (found) {
            return false;
        }
        return undefined;
    });

    return found;
}

export function expandBtnShouldInRow(props: ExpandBtnShouldInRowProps) {
    const { expandedRowRender, dataSource, hideExpandedColumn, childrenRecordName, rowExpandable } = props;
    const hasExpandedRowRender = typeof expandedRowRender === 'function';
    return (
        (hideExpandedColumn && hasExpandedRowRender) ||
        (!hasExpandedRowRender && dataSource.some(record => {
            const children = get(record, childrenRecordName);
            if ((Array.isArray(children) && children.length) || rowExpandable(record)) {
                return true;
            } else {
                return false;
            }
        }))
    );
}

export type ExpandBtnShouldInRowProps = {
    expandedRowRender: (record?: Record<string, any>, index?: number, expanded?: boolean) => any;
    dataSource: Record<string, any>[];
    hideExpandedColumn: boolean;
    childrenRecordName: string;
    rowExpandable: (record?: Record<string, any>) => boolean
};

/**
 * merge query
 * @param {*} query
 * @param {*} queries
 */
export function mergeQueries(query: Record<string, any>, queries: Record<string, any>[] = []) {
    let _mergedQuery;
    const idx = queries.findIndex(item => {
        if (query.dataIndex === item.dataIndex) {
            _mergedQuery = { ...item, ...query };
            return true;
        }
        return false;
    });

    if (idx > -1) {
        queries.splice(idx, 1, _mergedQuery);
    } else {
        queries.push(_mergedQuery);
    }
    return [...queries];
}

/**
 * Replace the width of the newColumns column with the width of the column after resize
 * @param {Object[]} columns columns retain the column width after resize
 * @param {Object[]} newColumns
 */
export function withResizeWidth(columns: Record<string, any>[], newColumns: Record<string, any>[]) {
    const _newColumns = [ ...newColumns ];
    for (const column of columns) {
        if (!isNullOrUndefined(column.width)) {
            const currentColumn = column.key;
            const columnIndex = findIndex(_newColumns, item => (item as any).key === currentColumn);
            if (columnIndex !== -1) {
                _newColumns[columnIndex].width = get(column, 'width');
            }
        }
    }
    return _newColumns;
}

/**
 * Pure function version of the same function in table foundation
 * This is not accessible in getDerivedStateFromProps, so fork one out
 */
export function getAllDisabledRowKeys({ dataSource, getCheckboxProps, childrenRecordName, rowKey }: GetAllDisabledRowKeysProps): (string | number)[] {
    const disabledRowKeys = [];
    if (Array.isArray(dataSource) && dataSource.length && typeof getCheckboxProps === 'function') {
        for (const record of dataSource) {
            const props = getCheckboxProps(record);
            const recordKey = typeof rowKey === 'function' ? rowKey(record) : get(record, rowKey);
            if (props && props.disabled) {
                disabledRowKeys.push(recordKey);
            }

            const children = get(record, childrenRecordName);

            if (Array.isArray(children) && children.length) {
                const keys = getAllDisabledRowKeys({ dataSource: children, getCheckboxProps });

                disabledRowKeys.push(...keys);
            }
        }
    }
    return disabledRowKeys;
}

export interface GetAllDisabledRowKeysProps {
    dataSource: Record<string, any>[];
    getCheckboxProps: (record?: Record<string, any>) => any;
    childrenRecordName?: string;
    rowKey?: string | number | ((record: Record<string, any>) => string | number)
}

export function warnIfNoDataIndex(column: Record<string, any>) {
    if (typeof column === 'object' && column !== null) {
        const { filters, sorter, dataIndex, onFilter } = column;
        const logger = new Logger('[@douyinfe/semi-ui Table]');
        if ((Array.isArray(filters) || isFunction(onFilter) || isFunction(sorter)) && isNullOrUndefined(dataIndex) ) {
            logger.warn(`The column with sorter or filter must pass the 'dataIndex' prop`);
        }
    }
}
/**
 * Whether is tree table
 */
export function isTreeTable({ dataSource, childrenRecordName = 'children' }: { dataSource: Record<string, any>; childrenRecordName?: string }) {
    let flag = false;
    if (Array.isArray(dataSource)) {
        for (const data of dataSource) {
            const children = get(data, childrenRecordName);
            if (Array.isArray(children) && children.length) {
                flag = true;
                break;
            }
        }
    }
    return flag;
}

export function getRTLAlign(align: typeof strings.ALIGNS[number], direction?: 'ltr' | 'rtl'): typeof strings.ALIGNS[number] {
    if (direction === 'rtl') {
        switch (align) {
            case 'left':
                return 'right';
            case 'right':
                return 'left';
            default:
                return align;
        }
    }
    return align;
}

export function getRTLFlexAlign(align: typeof strings.ALIGNS[number], direction?: 'ltr' | 'rtl'): typeof strings.JUSTIFY_CONTENT[number] {
    if (direction === 'rtl') {
        switch (align) {
            case 'left':
                return 'flex-end';
            case 'right':
                return 'flex-start';
            default:
                return align;
        }
    }
    else
    {
        switch (align) {
            case 'left':
                return 'flex-start';
            case 'right':
                return 'flex-end';
            default:
                return align;
        }
    }
}


export function shouldShowEllipsisTitle(ellipsis: BaseEllipsis) {
    const shouldShowTitle = ellipsis === true || get(ellipsis, 'showTitle', true);
    return shouldShowTitle;
}