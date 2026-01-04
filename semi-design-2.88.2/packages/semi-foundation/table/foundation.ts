import {
    get,
    merge,
    isFunction,
    each,
    find,
    some,
    pull,
    isSet,
    filter,
    isMap,
    slice,
    isEqual,
    isUndefined
} from 'lodash';
import memoizeOne from 'memoize-one';

import { ArrayElement } from '../utils/type';
import { BaseCheckboxProps } from '../checkbox/checkboxFoundation';
import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { strings, numbers } from './constants';
import { mergeQueries, flattenColumns, filterColumns } from './utils';
import { pullAll, withOrderSort } from '../utils/array';

export interface BaseColumnProps<RecordType> {
    align?: BaseAlign;
    children?: Array<BaseColumnProps<RecordType>>;
    className?: string;
    colSpan?: number;
    dataIndex?: string;
    defaultFilteredValue?: any[];
    defaultSortOrder?: BaseSortOrder;
    filterChildrenRecord?: boolean;
    filterDropdown?: any;
    filterDropdownProps?: Record<string, any>;
    filterDropdownVisible?: boolean;
    filterIcon?: any;
    filterMultiple?: boolean;
    filteredValue?: any[];
    filters?: BaseFilter[];
    fixed?: BaseFixed;
    key?: string | number;
    onCell?: BaseOnCell<RecordType>;
    onFilter?: BaseOnFilter<RecordType>;
    onFilterDropdownVisibleChange?: BaseOnFilterDropdownVisibleChange;
    onHeaderCell?: BaseOnHeaderCell<RecordType>;
    render?: (...args: any[]) => any;
    renderFilterDropdownItem?: (...args: any[]) => any;
    sortChildrenRecord?: boolean;
    sortOrder?: BaseSortOrder;
    sorter?: BaseSorter<RecordType>;
    title?: any;
    useFullRender?: boolean;
    width?: string | number;
    ellipsis?: BaseEllipsis
}

export interface OnChangeExtra {
    changeType?: 'sorter' | 'filter' | 'pagination'
}

interface MouseDownTarget {
    targetName: string;
    className: string
}

export interface TableAdapter<RecordType> extends DefaultAdapter {
    resetScrollY: () => void;
    setSelectedRowKeys: (selectedRowKeys: BaseRowKeyType[]) => void;
    setDisabledRowKeys: (disabledRowKeys: BaseRowKeyType[]) => void;
    setCurrentPage: (currentPage: number) => void;
    setPagination: (pagination: BasePagination) => void;
    setGroups: (groups: Map<string, RecordType[]>) => void;
    setDataSource: (dataSource: RecordType[]) => void;
    setExpandedRowKeys: (expandedRowKeys: BaseRowKeyType[]) => void;
    setQuery: (query?: BaseColumnProps<RecordType>) => void;
    setQueries: (queries: BaseColumnProps<RecordType>[]) => void;
    setFlattenData: (flattenData: RecordType[]) => void;
    setAllRowKeys: (allRowKeys: BaseRowKeyType[]) => void;
    setHoveredRowKey: (hoveredRowKey: BaseRowKeyType) => void;
    setCachedFilteredSortedDataSource: (filteredSortedDataSource: RecordType[]) => void;
    setCachedFilteredSortedRowKeys: (filteredSortedRowKeys: BaseRowKeyType[]) => void;
    getCurrentPage: () => number;
    getCurrentPageSize: () => number;
    getCachedFilteredSortedDataSource: () => RecordType[];
    getCachedFilteredSortedRowKeys: () => BaseRowKeyType[];
    getCachedFilteredSortedRowKeysSet: () => Set<BaseRowKeyType>;
    setAllDisabledRowKeys: (allDisabledRowKeys: BaseRowKeyType[]) => void;
    getAllDisabledRowKeys: () => BaseRowKeyType[];
    getAllDisabledRowKeysSet: () => Set<BaseRowKeyType>;
    notifyFilterDropdownVisibleChange: (visible: boolean, dataIndex: string) => void;
    notifyChange: (changeInfo: { pagination: BasePagination; filters: BaseChangeInfoFilter<RecordType>[]; sorter: BaseChangeInfoSorter<RecordType>; extra: OnChangeExtra }) => void;
    notifyExpand: (expanded?: boolean, record?: BaseIncludeGroupRecord<RecordType>, mouseEvent?: any) => void;
    notifyExpandedRowsChange: (expandedRows: BaseIncludeGroupRecord<RecordType>[]) => void;
    notifySelect: (record?: BaseIncludeGroupRecord<RecordType>, selected?: boolean, selectedRows?: BaseIncludeGroupRecord<RecordType>[], nativeEvent?: any) => void;
    notifySelectAll: (selected?: boolean, selectedRows?: BaseIncludeGroupRecord<RecordType>[], changedRows?: BaseIncludeGroupRecord<RecordType>[], e?: any) => void;
    notifySelectInvert: (record?: RecordType[], selected?: boolean, selectedRows?: BaseIncludeGroupRecord<RecordType>[], nativeEvent?: any) => void;
    notifySelectionChange: (selectedRowKeys: BaseRowKeyType[], selectedRows: BaseIncludeGroupRecord<RecordType>[]) => void;
    isAnyColumnFixed: (columns?: BaseColumnProps<RecordType>[]) => boolean;
    useFixedHeader: () => boolean;
    setHeadWidths: (headWidths: Array<BaseHeadWidth>, index?: number) => void;
    getHeadWidths: (index?: number) => number[];
    getCellWidths: (flattenedColumns: BaseColumnProps<RecordType>[], flattenedWidths?: BaseHeadWidth[], ignoreScrollBarKey?: boolean) => number[];
    mergedRowExpandable: (record: RecordType) => boolean;
    isAnyColumnUseFullRender: (columns: BaseColumnProps<RecordType>[]) => boolean;
    getNormalizeColumns: () => (columns: BaseColumnProps<RecordType>[], children: any) => BaseColumnProps<RecordType>[];
    getHandleColumns: () => (queries: BaseColumnProps<RecordType>[], cachedColumns: BaseColumnProps<RecordType>[]) => BaseColumnProps<RecordType>[];
    getMergePagination: () => (pagination: BasePagination) => BasePagination;
    setBodyHasScrollbar: (bodyHasScrollBar: boolean) => void;
    getTableLayout: () => 'fixed' | 'auto'
}

class TableFoundation<RecordType> extends BaseFoundation<TableAdapter<RecordType>> {
    memoizedWithFnsColumns: (
        queries: BaseColumnProps<RecordType>[], 
        cachedColumns: BaseColumnProps<RecordType>[], 
        rowSelectionUpdate: boolean, 
        hideExpandedColumn: boolean,
        bodyHasScrollBar: boolean,
    ) => BaseColumnProps<RecordType>[];
    memoizedFilterColumns: (columns: BaseColumnProps<RecordType>[], ignoreKeys?: string[]) => BaseColumnProps<RecordType>[];
    memoizedFlattenFnsColumns: (columns: BaseColumnProps<RecordType>[], childrenColumnName?: string) => BaseColumnProps<RecordType>[];
    memoizedPagination: (pagination: BasePagination) => BasePagination;

    /**
     * update columns in place, and use default values as initial values if the sorting and filtering columns have no values
     */
    static initColumnsFilteredValueAndSorterOrder(columns: BaseColumnProps<unknown>[]) {
        columns.forEach(column => {
            TableFoundation.initFilteredValue(column);
            TableFoundation.initSorterOrder(column);
        });
        return columns;
    }

    /**
     * init filteredValue of filtering column, use defaultFilteredValue or [] when it is undefined
     */
    static initFilteredValue(column: BaseColumnProps<unknown>) {
        const { defaultFilteredValue, filteredValue } = column;
        // There may be cases where onFilter is empty, such as server-side filtering
        // Because filterValue affects the output of filters, it needs to be initialized here
        if (isUndefined(filteredValue)) {
            if (Array.isArray(defaultFilteredValue) && defaultFilteredValue.length) {
                column.filteredValue = defaultFilteredValue;
            } else {
                column.filteredValue = [];
            }
        }
    }

    /**
     * init sortOrder of sorting column, use defaultSortOrder or [] when it is undefined
     */
    static initSorterOrder(column: BaseColumnProps<unknown>) {
        const { defaultSortOrder, sortOrder, sorter } = column;
        if (sorter && isUndefined(sortOrder)) {
            if (!isUndefined(defaultSortOrder)) {
                column.sortOrder = defaultSortOrder;
            } else {
                column.sortOrder = false;
            }
        }
    }

    mouseDownTarget: MouseDownTarget;

    constructor(adapter: TableAdapter<RecordType>) {
        super({ ...adapter });

        /**
         * memoized function list
         */
        const handleColumns: (queries: BaseColumnProps<RecordType>[], cachedColumns: BaseColumnProps<RecordType>[]) => BaseColumnProps<RecordType>[] = this._adapter.getHandleColumns();
        const mergePagination: (pagination: BasePagination) => BasePagination = this._adapter.getMergePagination();
        this.mouseDownTarget = null ;

        this.memoizedWithFnsColumns = memoizeOne(handleColumns, isEqual);
        this.memoizedFilterColumns = memoizeOne(filterColumns);
        this.memoizedFlattenFnsColumns = memoizeOne(flattenColumns);
        this.memoizedPagination = memoizeOne(mergePagination, isEqual);
    }

    init() {
        const dataSource = [...this.getProp('dataSource')];
        const { queries } = this._adapter.getStates();
        const filteredSortedDataSource = this.getFilteredSortedDataSource(dataSource, queries);
        const allDataDisabledRowKeys = this.getAllDisabledRowKeys(filteredSortedDataSource);
        const pageData = this.getCurrentPageData(filteredSortedDataSource);
        this.setAdapterPageData(pageData);
        this.initExpandedRowKeys(pageData);
        this.initSelectedRowKeys(pageData);
        // cache dataSource after mount, and then calculate it on demand
        this.setCachedFilteredSortedDataSource(filteredSortedDataSource);
        this.setAllDisabledRowKeys(allDataDisabledRowKeys);
    }

    initExpandedRowKeys({ groups }: { groups?: Map<string, RecordType[]> } = {}) {
        const {
            defaultExpandAllRows,
            defaultExpandedRowKeys = [],
            expandedRowKeys: propExpandedRowKeys = [],
            dataSource = [],
            expandAllRows,
            defaultExpandAllGroupRows,
            expandAllGroupRows,
        } = this.getProps();
        const expandedRowKeys: BaseRowKeyType[] = [];

        if (defaultExpandAllRows || expandAllRows) {
            this._addNoDuplicatedItemsToArr(
                expandedRowKeys,
                this.getAllRowKeys(dataSource),
                groups && isMap(groups) && groups.size ? Array.from(groups.keys()) : []
            );
        } else if (defaultExpandAllGroupRows || expandAllGroupRows) {
            this._addNoDuplicatedItemsToArr(
                expandedRowKeys,
                propExpandedRowKeys,
                groups && isMap(groups) && groups.size ? Array.from(groups.keys()) : []
            );
        } else if (Array.isArray(defaultExpandedRowKeys) && defaultExpandedRowKeys.length) {
            this._addNoDuplicatedItemsToArr(expandedRowKeys, defaultExpandedRowKeys);
        } else if (Array.isArray(propExpandedRowKeys) && propExpandedRowKeys.length) {
            this._addNoDuplicatedItemsToArr(expandedRowKeys, propExpandedRowKeys);
        }
        this._adapter.setExpandedRowKeys(expandedRowKeys);
    }

    initSelectedRowKeys({ disabledRowKeys }: { disabledRowKeys?: BaseRowKeyType[] }) {
        const rowSelection = this.getProp('rowSelection');
        const rowKeys: BaseRowKeyType[] = [];
        if (rowSelection) {
            const selectedRowKeys = get(rowSelection, 'selectedRowKeys');
            const defaultSelectedRowKeys = get(rowSelection, 'defaultSelectedRowKeys');

            if (Array.isArray(selectedRowKeys)) {
                this._addNoDuplicatedItemsToArr(rowKeys, selectedRowKeys);
            } else if (Array.isArray(defaultSelectedRowKeys)) {
                this._addNoDuplicatedItemsToArr(rowKeys, defaultSelectedRowKeys);
            }

            if (Array.isArray(disabledRowKeys) && disabledRowKeys.length) {
                pull(rowKeys, ...disabledRowKeys);
            }

            this._adapter.setSelectedRowKeys(rowKeys);
        }
    }

    /**
     * Get filtered and sorted data
     * @param {Object[]} dataSource
     * @param {Object[]} queries
     * @returns {Object[]} sortedDataSource
     */
    getFilteredSortedDataSource(dataSource: RecordType[], queries: BaseColumnProps<RecordType>[]) {
        const filteredDataSource = this.filterDataSource(dataSource, queries.filter(
            query => {
                const currentFilteredValue = query.filteredValue ? query.filteredValue : query.defaultFilteredValue;
                return (
                    isFunction(query.onFilter) &&
                    Array.isArray(currentFilteredValue) &&
                    currentFilteredValue.length
                );
            }
        ));
        const sortedDataSource = this.sortDataSource(filteredDataSource, queries.filter(query => query && isFunction(query.sorter)));
        return sortedDataSource;
    }

    /**
     * get current page data
     *
     * @param {Array} dataSource
     * @param {object} pagination
     * @param {object} queries
     * @returns {{dataSource: RecordType[], groups: Map<string, Set<string>>, pagination: object, disabledRowKeys: string[], queries: BaseColumnProps[], allRowKeys: string[]}}
     */
    getCurrentPageData(dataSource?: RecordType[], pagination?: BasePagination, queries?: BaseColumnProps<RecordType>[]) {
        const filteredSortedDataSource = this._adapter.getCachedFilteredSortedDataSource();
        dataSource = dataSource == null ? [...filteredSortedDataSource] : dataSource;
        pagination =
            pagination == null ? this.getState('pagination') && { ...this.getState('pagination') } : pagination;
        queries = queries == null ? [...this.getState('queries')] : queries;

        let groups;
        if (this.getProp('groupBy') != null) {
            const { groups: groupedGroups, dataSource: groupedData } = this.groupDataSource(dataSource);
            dataSource = groupedData;
            groups = groupedGroups;
        }

        pagination = this.normalizePagination(pagination, dataSource);

        dataSource = this.limitPageDataSource(dataSource, pagination);

        const disabledRowKeys = this.getAllDisabledRowKeys(dataSource);
        const allRowKeys = this.getAllRowKeys(dataSource);

        const pageData: BasePageData<RecordType> = {
            dataSource,
            groups,
            pagination,
            disabledRowKeys,
            allRowKeys,
            queries,
        };

        return pageData;
    }

    /**
     * group dataSource, return grouped row keys
     *
     * @param {*[]} dataSource
     * @param {Function|string} groupBy
     */
    groupDataSource(dataSource: RecordType[], groupBy?: BaseGroupBy<RecordType>) {
        groupBy = groupBy == null ? this.getProp('groupBy') : groupBy;
        const groups = new Map();
        const newDataSource = [];

        if (groupBy != null) {
            each(dataSource, (record, index) => {
                const groupKey = typeof groupBy === 'function' ? groupBy(record) : get(record, groupBy);

                if (groupKey != null && groupKey !== '') {
                    const recordKey = this.getRecordKey(record);
                    let group = groups.get(groupKey);

                    if (!isSet(group)) {
                        group = new Set([recordKey]);
                        groups.set(groupKey, group);
                    } else {
                        group.add(recordKey);
                    }
                }
            });
        }

        if (groups && groups.size) {
            groups.forEach((set, key) => {
                if (isSet(set)) {
                    set.forEach(realKey => {
                        newDataSource.push(this._getRecord(realKey));
                    });
                }
            });
        } else {
            newDataSource.push(...dataSource);
        }

        return { groups, dataSource: newDataSource };
    }

    /**
     * sort data
     *
     * @param {Array} dataSource
     * @param {Array} sorters
     * @returns {Array}
     */
    sortDataSource(dataSource: RecordType[], sorters: BaseSorterInfo<RecordType>[]) {
        each(sorters, sorterObj => { 
            // const sorterObj = last(sorters) || {};
            const { sorter, sortOrder, defaultSortOrder, sortChildrenRecord } = sorterObj;
            const currentSortOrder = this.isSortOrderValid(sortOrder) ? sortOrder : defaultSortOrder;
            if (isFunction(sorter) && (currentSortOrder && strings.SORT_DIRECTIONS.includes(currentSortOrder))) {
                if (sortChildrenRecord) {
                    const childrenRecordName = this.getProp('childrenRecordName');
                    dataSource =
                        dataSource &&
                        dataSource.map(record => {
                            const children = this._getRecordChildren(record);

                            if (Array.isArray(children) && children.length) {
                                return {
                                    ...record,
                                    [childrenRecordName]: this.sortDataSource(children, [sorterObj]),
                                };
                            }
                            return record;
                        });
                }

                dataSource.sort(withOrderSort(sorter, currentSortOrder));

                return false;
            }
            return undefined;
        });

        return dataSource;
    }

    /**
     * set page number
     */
    setPage = (currentPage: number, currentPageSize: number) => {
        currentPage = currentPage || this._adapter.getCurrentPage();
        const currentPagination = this.getState('pagination');
        const { dataSource, pagination, disabledRowKeys, allRowKeys } = this.getCurrentPageData(null, {
            ...currentPagination,
            currentPage,
            pageSize: currentPageSize,
        });
        if (!this._pagerIsControlled() && currentPage > 0) {
            this._adapter.setDisabledRowKeys(disabledRowKeys);
            this._adapter.setAllRowKeys(allRowKeys);
            this._adapter.setPagination(pagination);
            this._adapter.setDataSource(dataSource);
        }

        this._notifyChange(pagination, undefined, undefined, { changeType: 'pagination' });
    };

    /**
     * filter data source
     *
     * @param {*[]} dataSource
     * @param {*[]} filters
     * @returns {*[]}
     */
    filterDataSource(dataSource: RecordType[], filters: BaseChangeInfoFilter<RecordType>[]) {
        let filteredData: Map<string, RecordType> | null = null;
        let hasValidFilters = false;
        const childrenRecordName = this.getProp('childrenRecordName');

        each(filters, filterObj => {
            const { onFilter, filteredValue, filterChildrenRecord, defaultFilteredValue } = filterObj;
            const currentFilteredValue = Array.isArray(filteredValue) ? filteredValue : defaultFilteredValue;
            if (typeof onFilter === 'function' && Array.isArray(currentFilteredValue) && currentFilteredValue.length) {
                hasValidFilters = true;

                if (filteredData === null) {
                    filteredData = new Map();
                } else {
                    dataSource = Array.from(filteredData && filteredData.values());
                    filteredData = new Map();
                }
                each(dataSource, record => {
                    each(currentFilteredValue, value => {
                        const childrenRecords = get(record, childrenRecordName);
                        const recordKey = this.getRecordKey(record);

                        let filteredChildren;

                        if (Array.isArray(childrenRecords) && childrenRecords.length && filterChildrenRecord) {
                            filteredChildren = this.filterDataSource(childrenRecords, [filterObj]);
                        }

                        if (Array.isArray(filteredChildren) && filteredChildren.length) {
                            if (recordKey != null) {
                                const children = get(filteredData.get(recordKey), childrenRecordName, []);
                                filteredData.set(recordKey, {
                                    ...record,
                                    [childrenRecordName]: filteredChildren.reduce(
                                        (arr, cur) => {
                                            if (
                                                arr.find((item: any) => this.getRecordKey(item) === this.getRecordKey(cur)) ==
                                                null
                                            ) {
                                                arr.push(cur);
                                            }
                                            return arr;
                                        },
                                        // @ts-ignore
                                        [...children]
                                    ),
                                });
                            }
                        } else if (onFilter(value, record)) {
                            filteredData.set(recordKey, record);
                        }
                    });
                });
            }
        });

        if (hasValidFilters) {
            dataSource = Array.from(filteredData && filteredData.values());
        }

        return dataSource;
    }

    limitPageDataSource(dataSource: RecordType[], pagination: BasePagination) {
        dataSource = dataSource == null ? this.getProp('dataSource') : dataSource;
        pagination = pagination == null ? this.getState('pagination') : pagination;

        let pageData = dataSource;
        const pageNo = get(pagination, 'currentPage');

        if (this.getProp('pagination') !== false && pageNo && dataSource && pagination && !this._pagerIsControlled()) {
            const { pageSize = numbers.DEFAULT_PAGE_SIZE } = pagination;

            const start = (pageNo - 1) * pageSize;
            const end = pageNo * pageSize;

            pageData = slice(dataSource, start, end);
        }

        return pageData;
    }

    normalizePagination(pagination: BasePagination, dataSource: RecordType[]) {
        pagination = pagination == null ? this._getPagination() : pagination;
        dataSource = dataSource == null ? this._getDataSource() : dataSource;
        const propPagination = this.getProp('pagination');

        if (pagination) {
            pagination = typeof pagination === 'object' ? { ...pagination } : {};

            pagination = merge(
                {
                    total: (dataSource && dataSource.length) || 0,
                    pageSize: numbers.DEFAULT_PAGE_SIZE,
                    currentPage: get(propPagination, 'defaultCurrentPage', 1),
                    position: strings.PAGINATION_POSITIONS[0],
                },
                pagination
            );

            if (!this._pagerIsControlled()) {
                const total = get(propPagination, 'total', dataSource.length);
                const { currentPage, pageSize } = pagination;

                const realTotalPage = Math.ceil(total / pageSize);

                pagination.total = total;

                if (currentPage > realTotalPage) {
                    pagination.currentPage = 1;
                }
            }
        }

        return pagination;
    }

    setAdapterPageData(pageData: BasePageData<RecordType> = {}) {
        const { pagination, dataSource, disabledRowKeys, allRowKeys, groups } = pageData;
        this._adapter.setDisabledRowKeys(disabledRowKeys);
        this._adapter.setAllRowKeys(allRowKeys);
        this._adapter.setPagination(pagination);
        this._adapter.setGroups(groups);
        this._adapter.setDataSource(dataSource);
    }

    /**
     * Cache related data when initializing or updating the calculated dataSource
     * @param {*} filteredSortedDataSource
     */
    setCachedFilteredSortedDataSource = (filteredSortedDataSource: RecordType[]) => {
        this._adapter.setCachedFilteredSortedDataSource(filteredSortedDataSource);
        const filteredSortedRowKeys = this.getAllRowKeys(filteredSortedDataSource);
        this._adapter.setCachedFilteredSortedRowKeys(filteredSortedRowKeys);
    };

    destroy() { }

    setAllDisabledRowKeys(disabledRowKeys) {
        this._adapter.setAllDisabledRowKeys(disabledRowKeys);
    }

    handleClick(e: any) { }

    handleMouseEnter(e: any) { }

    handleMouseLeave(e: any) { }

    stopPropagation(e: any) {
        this._adapter.stopPropagation(e);
    }

    /**
     * Add non-repeating elements to the array itself
     */
    _addNoDuplicatedItemsToArr(srcArr: any[] = [], ...objArrs: any[][]) {
        for (const objArr of objArrs) {
            if (Array.isArray(objArr)) {
                for (const item of objArr) {
                    if (!srcArr.includes(item)) {
                        srcArr.push(item);
                    }
                }
            }
        }

        return srcArr;
    }

    _notifyChange(pagination: BasePagination, filters?: BaseChangeInfoFilter<RecordType>[], sorter?: BaseChangeInfoSorter<RecordType>, extra?: OnChangeExtra) {
        pagination = pagination == null ? this._getPagination() : pagination;
        filters = filters == null ? this._getAllFilters() : filters;
        sorter = sorter == null ? this._getAllSorters()[0] as BaseChangeInfoSorter<RecordType> : sorter;
        if (get(this.getProp('scroll'), 'scrollToFirstRowOnChange')) {
            this._adapter.resetScrollY();
        }
        this._adapter.notifyChange({
            pagination: { ...pagination },
            filters: [...filters],
            sorter,
            extra: { ...extra },
        });
    }

    _rowExpansionIsControlled() {
        return Array.isArray(this.getProp('expandedRowKeys'));
    }

    _pagerIsControlled() {
        return get(this.getProp('pagination'), 'currentPage') != null;
    }

    _selectionIsControlled() {
        return Array.isArray(get(this.getProp('rowSelection'), 'selectedRowKeys'));
    }

    /**
     * Determine whether the column sorting is controlled
     * Controlled: the column passed the sortOrder prop
     * @param {String} dataIndex
     * @returns {Boolean}
     */
    _sorterIsControlled(dataIndex: string) {
        // The basis for judgment should be props columns instead of cachedColumns fix#1141
        const query = dataIndex && this.getQuery(dataIndex, this.getState('flattenColumns'));
        return Boolean(query && query.sortOrder != null);
    }

    /**
     * Determine whether the column is filtered and controlled
     * Controlled: the column passed the filteredValue prop
     * @param {String} dataIndex
     * @returns {Boolean}
     */
    _filterIsControlled(dataIndex: string) {
        const query = dataIndex && this.getQuery(dataIndex, this.getState('flattenColumns'));
        return Boolean(query && Array.isArray(query.filteredValue));
    }

    _filterShowIsControlled(dataIndex?: string) {
        const query = dataIndex && this.getQuery(dataIndex, this.getState('flattenColumns'));

        return Boolean(query && (query.filterDropdownVisible === true || query.filterDropdownVisible === false));
    }

    _getSelectedRowKeys() {
        const rowSelection = this.getState('rowSelection');
        const selectedRowKeys = get(rowSelection, 'selectedRowKeys', []);

        return [...selectedRowKeys];
    }

    _getSelectedRowKeysSet() {
        const rowSelection = this.getState('rowSelection');
        const selectedRowKeysSet = get(rowSelection, 'selectedRowKeysSet', new Set());

        return selectedRowKeysSet;
    }

    _getDataSource() {
        return this.getProp('dataSource') || [];
    }

    _getRecord(realKey: string | number) {
        return find(
            this.getProp('dataSource'),
            record => realKey != null && realKey !== '' && this.getRecordKey(record) === realKey
        );
    }

    _getRecordChildren(record: RecordType) {
        return get(record, this.getProp('childrenRecordName'));
    }

    _getPagination() {
        return this.getState('pagination') || {};
    }

    /**
     * Filters are considered valid if filteredValue exists
     */
    _getAllFilters(queries?: BaseColumnProps<RecordType>[]) {
        queries = queries || this.getState('queries');
        const filters: BaseChangeInfoFilter<RecordType>[] = [];

        each(queries, query => {
            if (
                Array.isArray(query.filteredValue) &&
                (query.filteredValue.length || this._filterIsControlled(query.dataIndex))
            ) {
                filters.push(query);
            }
        });

        return filters;
    }

    _getAllSorters(queries?: BaseColumnProps<RecordType>[]): BaseColumnProps<RecordType>[] {
        queries = queries || this.getState('queries');

        return filter(queries, query => query.sorter && query.sortOrder) as BaseColumnProps<RecordType>[];
    }

    _filterQueries(targetQuery: BaseColumnProps<RecordType>, queries: BaseColumnProps<RecordType>[], keys = ['dataIndex']) {
        queries = queries == null ? this.getState('queries') : queries;
        const filteredQueries: BaseColumnProps<RecordType>[] = [];
        const filteredIndexes: number[] = [];

        each(queries, (itQuery, index) => {
            const flag = some(keys, k => k && targetQuery[k] != null && targetQuery[k] === itQuery[k]);

            if (flag) {
                filteredQueries.push(itQuery);
                filteredIndexes.push(index);
            }
        });

        return { filteredQueries, filteredIndexes };
    }

    _mergeToQueries(query: BaseColumnProps<RecordType>, queries: BaseColumnProps<RecordType>[], keys = ['dataIndex']) {
        queries = queries == null ? this.getState('queries') : queries;
        queries = [...queries];
        query = { ...query };

        const { filteredQueries, filteredIndexes } = this._filterQueries(query, queries, keys);

        each(filteredQueries, (curQuery, idx) => {
            // assign(curQuery, query);
            queries[filteredIndexes[idx]] = { ...query };
        });

        return queries;
    }

    /**
     * get record real key
     * @param {RecordType} record
     * @returns {string}
     */
    getRecordKey(record: RecordType): string {
        if (!record) {
            return undefined;
        }
        const rowKey = this.getProp('rowKey');
        return typeof rowKey === 'function' ? rowKey(record) : get(record, rowKey);
    }

    isEmpty(dataSource: RecordType[]) {
        dataSource = dataSource == null ? this.getProp('dataSource') : dataSource;

        return !(Array.isArray(dataSource) && dataSource.length > 0);
    }

    handleSelectRow(realKey: BaseRowKeyType, selected: boolean, e: any) {
        this.stopPropagation(e);
        if (typeof selected === 'boolean' && realKey != null) {
            const selectedRowKeys = this._getSelectedRowKeys();
            let foundIdx = -1;
            const selectedRow = this.getSelectedRows(null, [realKey])[0];
            let selectedRows: BaseIncludeGroupRecord<RecordType>[];

            if ((foundIdx = selectedRowKeys.indexOf(realKey)) > -1 && selected === false) {
                selectedRowKeys.splice(foundIdx, 1);
                selectedRows = this.getSelectedRows(null, selectedRowKeys);
                if (!this._selectionIsControlled()) {
                    this._adapter.setSelectedRowKeys(selectedRowKeys);
                }
                this._adapter.notifySelect(selectedRow, selected, selectedRows, e);
                this._adapter.notifySelectionChange(selectedRowKeys, selectedRows);
            } else if (selectedRowKeys.indexOf(realKey) === -1 && selected === true) {
                selectedRowKeys.push(realKey);
                selectedRows = this.getSelectedRows(null, selectedRowKeys);
                if (!this._selectionIsControlled()) {
                    this._adapter.setSelectedRowKeys(selectedRowKeys);
                }
                this._adapter.notifySelect(selectedRow, selected, selectedRows, e);
                this._adapter.notifySelectionChange(selectedRowKeys, selectedRows);
            }
        }
    }

    /**
     * select all rows
     * @param {*} selected The future state of the select all button
     * @param {*} e
     */
    handleSelectAllRow(selected: boolean, e: any) {
        this.stopPropagation(e);
        if (typeof selected === 'boolean') {
            const curSelectedRowKeys = this._getSelectedRowKeys();
            let selectedRowKeys = [...curSelectedRowKeys];
            const selectedRowKeysSet = this._getSelectedRowKeysSet();
            let allRowKeys = [...this._adapter.getCachedFilteredSortedRowKeys()];
            const disabledRowKeys = this._adapter.getAllDisabledRowKeys();
            const disabledRowKeysSet = this._adapter.getAllDisabledRowKeysSet();
            let changedRowKeys;

            // Select all, if not disabled && not in selectedRowKeys
            if (selected) {
                for (const key of allRowKeys) {
                    if (!disabledRowKeysSet.has(key) && !selectedRowKeysSet.has(key)) {
                        selectedRowKeys.push(key);
                    }
                }
                allRowKeys = pullAll(allRowKeys, [...disabledRowKeys, ...curSelectedRowKeys]);
                changedRowKeys = [...allRowKeys];
            } else {
                selectedRowKeys = pullAll(selectedRowKeys, allRowKeys);
                changedRowKeys = [...curSelectedRowKeys];
            }

            const changedRows = this.getSelectedRows(null, changedRowKeys || []);
            const selectedRows = this.getSelectedRows(null, selectedRowKeys || []);

            if (!this._selectionIsControlled()) {
                this._adapter.setSelectedRowKeys(selectedRowKeys);
            }
            this._adapter.notifySelectAll(selected, selectedRows, changedRows, e);
            this._adapter.notifySelectionChange(selectedRowKeys, selectedRows);
        }
    }

    /**
     * row keys => rows
     * @param {*} dataSource
     * @param {*} selectedRowKeys
     * @param {*} selectedRowKeysSet Recursive optimization
     */
    getSelectedRows(dataSource: RecordType[], selectedRowKeys: BaseRowKeyType[], selectedRowKeysSet?: Set<BaseRowKeyType>): BaseIncludeGroupRecord<RecordType>[] {
        dataSource = dataSource == null ? this._getDataSource() : dataSource;
        selectedRowKeys = selectedRowKeys == null ? this._getSelectedRowKeys() : selectedRowKeys;
        if (!isSet(selectedRowKeysSet)) {
            selectedRowKeysSet = new Set(selectedRowKeys);
        }
        const childrenRecordName = this.getProp('childrenRecordName');

        const selectedRows: BaseIncludeGroupRecord<RecordType>[] = [];

        if (
            isSet(selectedRowKeysSet) &&
            selectedRowKeysSet.size &&
            Array.isArray(dataSource) &&
            dataSource.length
        ) {
            // Time complexity optimization, replace the includes operation of array with has of set
            selectedRows.push(...dataSource.filter(data => selectedRowKeysSet.has(this.getRecordKey(data))));

            if (selectedRows.length < selectedRowKeys.length) {
                for (const item of dataSource) {
                    const children = get(item, childrenRecordName);
                    if (Array.isArray(children) && children.length) {
                        const rows = this.getSelectedRows(children, selectedRowKeys, selectedRowKeysSet);
                        selectedRows.push(...rows);
                    }
                }
            }
        }

        return selectedRows;
    }

    getAllDisabledRowKeys(dataSource?: RecordType[], getCheckboxProps?: GetCheckboxProps<RecordType>): BaseRowKeyType[] {
        dataSource = dataSource == null ? this._getDataSource() : dataSource;
        getCheckboxProps =
            getCheckboxProps == null ? get(this.getProp('rowSelection'), 'getCheckboxProps') : getCheckboxProps;
        const childrenRecordName = this.getProp('childrenRecordName');

        const disabledRowKeys: BaseRowKeyType[] = [];
        if (Array.isArray(dataSource) && dataSource.length && typeof getCheckboxProps === 'function') {
            for (const record of dataSource) {
                const props = getCheckboxProps(record);

                if (props && props.disabled) {
                    disabledRowKeys.push(this.getRecordKey(record));
                }

                const children = get(record, childrenRecordName);

                if (Array.isArray(children) && children.length) {
                    const keys: BaseRowKeyType[] = this.getAllDisabledRowKeys(children, getCheckboxProps);

                    disabledRowKeys.push(...keys);
                }
            }
        }
        return disabledRowKeys;
    }

    getAllRowKeys(dataSource: RecordType[]): BaseRowKeyType[] {
        dataSource = dataSource == null ? this._getDataSource() : dataSource;
        const childrenRecordName = this.getProp('childrenRecordName');

        const allRowKeys = [];

        if (Array.isArray(dataSource) && dataSource.length) {
            for (const record of dataSource) {
                const childrenRowKeys = [];
                const children = get(record, childrenRecordName);
                if (Array.isArray(children) && children.length) {
                    childrenRowKeys.push(...this.getAllRowKeys(children));
                }
                allRowKeys.push(this.getRecordKey(record), ...childrenRowKeys);
            }
        }

        return allRowKeys;
    }

    /**
     * Check if the selected item is in allRowKeysSet
     * @param {Array} selectedRowKeys
     * @param {Set} allRowKeysSet
     */
    hasRowSelected(selectedRowKeys: BaseRowKeyType[], allRowKeysSet: Set<BaseRowKeyType>) {
        return Boolean(Array.isArray(selectedRowKeys) &&
            selectedRowKeys.length &&
            isSet(allRowKeysSet) &&
            allRowKeysSet.size &&
            selectedRowKeys.filter(key => allRowKeysSet.has(key)).length);
    }

    /**
     * expand processing function
     * @param {Boolean} expanded
     * @param {String} realKey
     * @param {Event} domEvent
     */
    handleRowExpanded(expanded: boolean, realKey: string, domEvent: any) {
        this.stopPropagation(domEvent);

        const expandedRowKeys = [...this.getState('expandedRowKeys')];

        const index = expandedRowKeys.indexOf(realKey);
        const keyIsValid = typeof realKey === 'string' || typeof realKey === 'number';

        if (keyIsValid && expanded && index === -1) {
            expandedRowKeys.push(realKey);
        } else if (keyIsValid && !expanded && index > -1) {
            expandedRowKeys.splice(index, 1);
        }

        if (!this._rowExpansionIsControlled()) {
            this._adapter.setExpandedRowKeys(expandedRowKeys);
        }

        const expandedRows = this.getSelectedRows(null, expandedRowKeys);
        let expandedRow = this.getSelectedRows(null, [realKey])[0];

        // groups record processing
        const groups = this._getGroups();
        if (groups) {
            // Construct group expandRow
            if (groups.has(realKey)) {
                expandedRow = { groupKey: realKey };
            }

            // If expandedRowKeys includes groupKey, add to expandedRows
            for (let i = 0, len = expandedRowKeys.length; i < len; i++) {
                if (groups.has(realKey)) {
                    expandedRows.push({ groupKey: expandedRowKeys[i] });
                }
            }
        }

        this._adapter.notifyExpand(expanded, expandedRow, domEvent);
        this._adapter.notifyExpandedRowsChange(expandedRows);
    }

    /**
     * get state.groups
     * @returns {Map|Null}
     */
    _getGroups() {
        const groupBy = this._adapter.getProp('groupBy');
        if (groupBy !== null) {
            const groups = this._adapter.getState('groups');
            return groups;
        }
        return null;
    }

    /**
     * Determine whether you have selected all except for disabled
     * @param {Set} selectedRowKeysSet
     * @param {Set} disabledRowKeysSet
     * @param {Array} allKeys keys after sorted and filtered
     */
    allIsSelected(selectedRowKeysSet: Set<BaseRowKeyType>, disabledRowKeysSet: Set<BaseRowKeyType>, allKeys: BaseRowKeyType[]) {
        const filteredAllKeys = filter(allKeys, key => key != null && !disabledRowKeysSet.has(key));
        if (filteredAllKeys && filteredAllKeys.length) {
            for (const key of filteredAllKeys) {
                if (key != null && !selectedRowKeysSet.has(key)) {
                    return false;
                }
            }
            return true;
        } else {
            const isAllSelected = allKeys.length && allKeys.every(rowKey => selectedRowKeysSet.has(rowKey));
            return isAllSelected || false;
        }
    }

    /**
     * This function is not used yet
     * @param {*} selectedRowKeys
     * @param {*} allKeys
     */
    allIsNotSelected(selectedRowKeys: BaseRowKeyType[], allKeys: BaseRowKeyType[]) {
        for (const key of allKeys) {
            if (key != null && Array.isArray(selectedRowKeys) && selectedRowKeys.includes(key)) {
                return true;
            }
        }
        return false;
    }

    formatPaginationInfo(pagination: BasePagination = {}, defaultPageText = '') {
        let info = '';

        const formatPageText = get(this.getProp('pagination'), 'formatPageText');
        const { total, pageSize, currentPage } = pagination;
        const currentStart = Math.min((currentPage - 1) * pageSize + 1, total);
        const currentEnd = Math.min(currentPage * pageSize, total);

        if (formatPageText || (formatPageText !== false && defaultPageText && total > 0)) {
            info =
                typeof formatPageText === 'function' ?
                    formatPageText({ currentStart, currentEnd, total }) :
                    defaultPageText
                        .replace('${currentStart}', currentStart as any)
                        .replace('${currentEnd}', currentEnd as any)
                        .replace('${total}', total as any);
        }

        return info;
    }

    toggleShowFilter(dataIndex: string, visible: boolean) {
        let filterObj: BaseColumnProps<RecordType> = this.getQuery(dataIndex);
        const filterDropdownVisible = visible;

        filterObj = { ...filterObj, filterDropdownVisible };

        if (!this._filterShowIsControlled()) {
            // this._adapter.setQuery({
            //     ...filterObj,
            //     filterDropdownVisible,
            // });
        }
        this._adapter.notifyFilterDropdownVisibleChange(filterDropdownVisible, dataIndex);
    }

    /**
     * Called when the filter changes
     * @param {*} dataIndex
     * @param {*} data
     */
    handleFilterSelect(dataIndex: string, data: { filteredValue?: string[] } = {}) {
        let query: BaseColumnProps<RecordType> = this.getQuery(dataIndex);
        let queries = [...this._adapter.getState('queries')];
        const { filteredValue } = data;

        query = {
            ...query,
            filteredValue,
        };

        queries = mergeQueries(query, queries);
        const mergedQueries = this._mergeToQueries(query, null);
        const filters = this._getAllFilters(mergedQueries);

        if (!this._filterIsControlled(dataIndex)) {
            this._adapter.setQueries(queries);
            this.handleClickFilterOrSorter(queries);
        }

        this._notifyChange(null, filters, undefined, { changeType: 'filter' });
    }

    /**
     * Click the sort button to call
     * @param {*} column
     * @param {*} e
     */
    handleSort(column: { dataIndex?: string; sortOrder?: BaseSortOrder } = {}, e: any, check = false) {
        this.stopPropagation(e);
        /* if mouse down to the resizable handle, do not trigger the sorting，fix #2802
            The target of the click event may be different from the target of the mousedown, 
            e.g: Press the mouse, move to another node and then release it，
            So according to the event in the mousedown to determine whether to trigger the sorting
        */ 
        if (check) {
            if (this.mouseDownTarget && this.mouseDownTarget?.targetName === 'SPAN' && 
                this.mouseDownTarget?.className?.includes?.('react-resizable-handle')
            ) {
                return;
            }
            this.mouseDownTarget = null;
        }

        const { dataIndex } = column;

        let queries = this.getState('queries');
        let curQuery = null;

        queries = [...queries];

        each(queries, (query, idx, arr) => {
            if (query.sorter) {
                const sorterObj = { ...query };

                const stateSortOrder = get(sorterObj, 'sortOrder');
                const defaultSortOrder = get(sorterObj, 'defaultSortOrder', false);
                let querySortOrder = this.isSortOrderValid(stateSortOrder) ? stateSortOrder : defaultSortOrder;

                if (dataIndex && dataIndex === sorterObj.dataIndex) {
                    if (querySortOrder === strings.SORT_DIRECTIONS[0]) {
                        querySortOrder = strings.SORT_DIRECTIONS[1];
                    } else if (querySortOrder === strings.SORT_DIRECTIONS[1]) {
                        querySortOrder = false;
                    } else {
                        querySortOrder = strings.SORT_DIRECTIONS[0];
                    }
                } else {
                    // This results in the current click only supports single column sorting
                    querySortOrder = false;
                }

                arr[idx] = { ...sorterObj, sortOrder: querySortOrder };

                if (dataIndex === sorterObj.dataIndex) {
                    curQuery = arr[idx];
                }
            }
        });

        if (!this._sorterIsControlled(dataIndex)) {
            this._adapter.setQueries(queries);
            this.handleClickFilterOrSorter(queries);
        }

        // notify sort event
        this._notifyChange(null, null, curQuery, { changeType: 'sorter' });
    }

    handleMouseDown = (e: any) => {
        this.mouseDownTarget = {
            targetName: e.target?.tagName,
            className: e.target?.className,
        };
    }

    /**
     * Recalculate the cached data after clicking filter or sorter
     * @param {*} queries
     */
    handleClickFilterOrSorter(queries: BaseColumnProps<RecordType>[]) {
        const dataSource = [...this.getProp('dataSource')];
        const sortedDataSource = this.getFilteredSortedDataSource(dataSource, queries);
        const allDataDisabledRowKeys = this.getAllDisabledRowKeys(sortedDataSource);
        this.setCachedFilteredSortedDataSource(sortedDataSource);
        this.setAllDisabledRowKeys(allDataDisabledRowKeys);
        const pageData = this.getCurrentPageData(sortedDataSource);
        this.setAdapterPageData(pageData);
    }

    getQuery(dataIndex: string, queries?: BaseColumnProps<RecordType>[]) {
        queries = queries || this.getState('queries');

        if (dataIndex != null) {
            return find(queries, query => query.dataIndex === dataIndex);
        }
        return undefined;
    }

    getCellWidths(flattenedColumns: BaseColumnProps<RecordType>[], flattenedWidths?: BaseHeadWidth[], ignoreScrollBarKey?: boolean) {
        return this._adapter.getCellWidths(flattenedColumns, flattenedWidths, ignoreScrollBarKey);
    }

    setHeadWidths(headWidths: Array<BaseHeadWidth>, index?: number) {
        return this._adapter.setHeadWidths(headWidths, index);
    }

    getHeadWidths(index: number) {
        return this._adapter.getHeadWidths(index);
    }

    mergedRowExpandable(record: RecordType) {
        return this._adapter.mergedRowExpandable(record);
    }

    setBodyHasScrollbar(bodyHasScrollbar: boolean) {
        this._adapter.setBodyHasScrollbar(bodyHasScrollbar);
    }

    isSortOrderValid = (sortOrder: BaseSortOrder) => strings.SORT_DIRECTIONS.includes(sortOrder as any) || sortOrder === false;
}

export type BaseRowKeyType = string | number;
export interface BasePagination {
    total?: number;
    currentPage?: number;
    pageSize?: number;
    position?: ArrayElement<typeof strings.PAGINATION_POSITIONS>;
    defaultCurrentPage?: number;
    formatPageText?: any
}
export interface BaseHeadWidth {
    width: number;
    key: string
}
export interface BasePageData<RecordType> {
    dataSource?: RecordType[];
    groups?: Map<string, RecordType[]>;
    pagination?: BasePagination;
    disabledRowKeys?: BaseRowKeyType[];
    allRowKeys?: BaseRowKeyType[];
    queries?: BaseColumnProps<RecordType>[]
}

export type GetCheckboxProps<RecordType> = (record?: RecordType) => BaseCheckboxProps;
export type BaseGroupBy<RecordType> = string | number | BaseGroupByFn<RecordType>;
export type BaseGroupByFn<RecordType> = (record?: RecordType) => string | number;
export interface BaseSorterInfo<RecordType> {
    [x: string]: any;
    dataIndex?: string;
    sortOrder?: BaseSortOrder;
    sorter?: BaseSorter<RecordType>
}
export type BaseSortOrder = boolean | ArrayElement<typeof strings.SORT_DIRECTIONS>;
export type BaseSorter<RecordType> = boolean | ((a?: RecordType, b?: RecordType, sortOrder?: 'ascend' | 'descend') => number);
export interface BaseChangeInfoFilter<RecordType> {
    dataIndex?: string;
    value?: any;
    text?: any;
    filters?: BaseFilter[];
    onFilter?: (filteredValue?: any, record?: RecordType) => boolean;
    filteredValue?: any[];
    defaultFilteredValue?: any[];
    children?: BaseFilter[];
    filterChildrenRecord?: boolean
}
export interface BaseFilter {
    value?: any;
    text?: any;
    children?: BaseFilter[]
}
export type BaseFixed = ArrayElement<typeof strings.FIXED_SET>;
export type BaseAlign = ArrayElement<typeof strings.ALIGNS>;
export type BaseOnCell<RecordType> = (record?: RecordType, rowIndex?: number) => BaseOnCellReturnObject;
export interface BaseOnCellReturnObject {
    [x: string]: any;
    style?: Record<string, any>;
    className?: string;
    onClick?: (e: any) => void
}
export type BaseOnFilter<RecordType> = (filteredValue?: any, record?: RecordType) => boolean;

export type BaseOnFilterDropdownVisibleChange = (visible?: boolean) => void;

export type BaseOnHeaderCell<RecordType> = (record?: RecordType, columnIndex?: number) => BaseOnHeaderCellReturnObject;

export interface BaseOnHeaderCellReturnObject {
    [x: string]: any;
    style?: Record<string, any>;
    className?: string;
    onClick?: (e: any) => void
}
export interface BaseChangeInfoSorter<RecordType> {
    [x: string]: any;
    dataIndex: string;
    sortOrder: BaseSortOrder;
    sorter: BaseSorter<RecordType>
}

export type BaseIncludeGroupRecord<RecordType> = RecordType | { groupKey: string };

export type BaseEllipsis = boolean | { showTitle: boolean };

export default TableFoundation;
