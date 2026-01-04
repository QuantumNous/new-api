/* eslint-disable react/no-did-update-set-state */
import React, { ReactNode, createRef, isValidElement } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import {
    get,
    noop,
    includes,
    find,
    findIndex,
    some,
    debounce,
    flattenDeep,
    each,
    omit,
    isNull,
    difference,
    isFunction,
    isObject,
    isPlainObject
} from 'lodash';

import {
    mergeQueries,
    equalWith,
    isAnyFixedRight,
    assignColumnKeys,
    flattenColumns,
    getAllDisabledRowKeys,
    shouldShowEllipsisTitle
} from '@douyinfe/semi-foundation/table/utils';
import Store from '@douyinfe/semi-foundation/utils/Store';
import TableFoundation, { TableAdapter, BasePageData, BaseRowKeyType, BaseHeadWidth } from '@douyinfe/semi-foundation/table/foundation';
import { TableSelectionCellEvent } from '@douyinfe/semi-foundation/table/tableSelectionCellFoundation';
import { strings, cssClasses, numbers } from '@douyinfe/semi-foundation/table/constants';
import '@douyinfe/semi-foundation/table/table.scss';

import Spin from '../spin';
import BaseComponent from '../_base/baseComponent';
import LocaleConsumer from '../locale/localeConsumer';
import ColumnShape from './ColumnShape';
import getColumns from './getColumns';
import TableContext, { TableContextProps } from './table-context';
import TableContextProvider from './TableContextProvider';
import ColumnSelection from './ColumnSelection';
import TablePagination from './TablePagination';
import ColumnFilter, { OnSelectData } from './ColumnFilter';
import ColumnSorter from './ColumnSorter';
import ExpandedIcon from './CustomExpandIcon';
import HeadTable, { HeadTableProps } from './HeadTable';
import BodyTable, { BodyProps } from './Body';
import { logger, cloneDeep, mergeComponents, mergeColumns } from './utils';
import {
    ColumnProps,
    TablePaginationProps,
    BodyScrollEvent,
    BodyScrollPosition,
    ExpandIcon,
    ColumnTitleProps,
    Pagination,
    RenderPagination,
    TableLocale,
    TableProps,
    TableComponents,
    RowSelectionProps,
    Data
} from './interface';
import { ArrayElement } from '../_base/base';
import ConfigContext from '../configProvider/context';

export type NormalTableProps<RecordType extends Record<string, any> = Data> = Omit<TableProps<RecordType>, 'resizable'>;

export interface NormalTableState<RecordType extends Record<string, any> = Data> {
    cachedColumns?: ColumnProps<RecordType>[];
    cachedChildren?: React.ReactNode;
    flattenColumns?: ColumnProps<RecordType>[];
    components?: TableComponents;
    queries?: ColumnProps<RecordType>[];
    dataSource?: RecordType[];
    flattenData?: RecordType[];
    expandedRowKeys?: (string | number)[];
    rowSelection?: TableStateRowSelection<RecordType>;
    pagination?: Pagination;
    groups?: Map<string, RecordType[]>;
    allRowKeys?: (string | number)[];
    disabledRowKeys?: (string | number)[];
    disabledRowKeysSet?: Set<string | number>;
    headWidths?: Array<Array<BaseHeadWidth>>;
    bodyHasScrollBar?: boolean;
    prePropRowSelection?: TableStateRowSelection<RecordType>;
    tableWidth?: number;
    prePagination?: Pagination;
    /**
    * Disabled row keys in sorted and filtered data
    */
    allDisabledRowKeys?: BaseRowKeyType[];
    /**
     * Disabled row keys set in sorted and filtered data
     */
    allDisabledRowKeysSet?: Set<BaseRowKeyType>
}

export type TableStateRowSelection<RecordType extends Record<string, any> = Data> = (RowSelectionProps<RecordType> & { selectedRowKeysSet?: Set<(string | number)> }) | boolean;

export interface RenderTableProps<RecordType> extends HeadTableProps, BodyProps {
    filteredColumns: ColumnProps<RecordType>[];
    useFixedHeader: boolean;
    bodyRef: React.MutableRefObject<HTMLDivElement> | ((instance: any) => void);
    rowSelection: TableStateRowSelection<RecordType>;
    bodyHasScrollBar: boolean
}

class Table<RecordType extends Record<string, any>> extends BaseComponent<NormalTableProps<RecordType>, NormalTableState<RecordType>> {
    static contextType = TableContext;

    static propTypes = {
        className: PropTypes.string,
        style: PropTypes.object,
        prefixCls: PropTypes.string,
        components: PropTypes.any,
        bordered: PropTypes.bool,
        loading: PropTypes.bool,
        size: PropTypes.oneOf(strings.SIZES),
        tableLayout: PropTypes.oneOf(strings.LAYOUTS),
        columns: PropTypes.arrayOf(PropTypes.shape(ColumnShape)),
        hideExpandedColumn: PropTypes.bool,
        id: PropTypes.string,
        expandIcon: PropTypes.oneOfType([PropTypes.bool, PropTypes.func, PropTypes.node]),
        expandCellFixed: PropTypes.oneOf(strings.FIXED_SET),
        title: PropTypes.oneOfType([PropTypes.string, PropTypes.node, PropTypes.func]),
        onHeaderRow: PropTypes.func,
        showHeader: PropTypes.bool,
        indentSize: PropTypes.number,
        rowKey: PropTypes.oneOfType([PropTypes.func, PropTypes.string, PropTypes.number]),
        onRow: PropTypes.func,
        onExpandedRowsChange: PropTypes.func,
        onExpand: PropTypes.func,
        rowExpandable: PropTypes.func,
        expandedRowRender: PropTypes.func,
        expandedRowKeys: PropTypes.array,
        defaultExpandAllRows: PropTypes.bool,
        expandAllRows: PropTypes.bool,
        defaultExpandAllGroupRows: PropTypes.bool,
        expandAllGroupRows: PropTypes.bool,
        defaultExpandedRowKeys: PropTypes.array,
        pagination: PropTypes.oneOfType([PropTypes.object, PropTypes.bool]),
        renderPagination: PropTypes.func,
        footer: PropTypes.oneOfType([PropTypes.func, PropTypes.string, PropTypes.node]),
        empty: PropTypes.node,
        dataSource: PropTypes.array,
        childrenRecordName: PropTypes.string, // children data property name
        rowSelection: PropTypes.oneOfType([PropTypes.object, PropTypes.bool]),
        onChange: PropTypes.func,
        scroll: PropTypes.shape({
            x: PropTypes.oneOfType([PropTypes.number, PropTypes.string, PropTypes.bool]),
            y: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        }),
        groupBy: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.func]),
        renderGroupSection: PropTypes.oneOfType([PropTypes.func]),
        onGroupedRow: PropTypes.func,
        clickGroupedRowToExpand: PropTypes.bool,
        virtualized: PropTypes.oneOfType([PropTypes.object, PropTypes.bool]),
        dropdownPrefixCls: PropTypes.string, // TODO: future api
        expandRowByClick: PropTypes.bool, // TODO: future api
        getVirtualizedListRef: PropTypes.func, // TODO: future api
    };

    static defaultProps = {
        // rowExpandable: stubTrue,
        tableLayout: '',
        dataSource: [] as [],
        prefixCls: cssClasses.PREFIX,
        rowSelection: null as null,
        className: '',
        childrenRecordName: 'children',
        size: 'default',
        loading: false,
        bordered: false,
        expandCellFixed: false,
        hideExpandedColumn: true,
        showHeader: true,
        indentSize: numbers.DEFAULT_INDENT_WIDTH,
        onChange: noop,
        pagination: true,
        rowKey: 'key',
        defaultExpandedRowKeys: [] as [],
        defaultExpandAllRows: false,
        defaultExpandAllGroupRows: false,
        expandAllRows: false,
        expandAllGroupRows: false,
        onFilterDropdownVisibleChange: noop,
        onExpand: noop,
        onExpandedRowsChange: noop,
        expandRowByClick: false,
    };

    get adapter(): TableAdapter<RecordType> {
        return {
            ...super.adapter,
            resetScrollY: () => {
                if (this.bodyWrapRef.current) {
                    this.bodyWrapRef.current.scrollTop = 0;
                }
            },
            setSelectedRowKeys: selectedRowKeys => {
                this.setState({
                    rowSelection: {
                        ...this.state.rowSelection as Record<string, any>,
                        selectedRowKeys: [...selectedRowKeys],
                        selectedRowKeysSet: new Set(selectedRowKeys),
                    }
                });
            },
            setDisabledRowKeys: disabledRowKeys => {
                this.setState({ disabledRowKeys, disabledRowKeysSet: new Set(disabledRowKeys) });
            },
            setCurrentPage: currentPage => {
                const { pagination } = this.state;
                if (typeof pagination === 'object') {
                    this.setState({ pagination: { ...pagination, currentPage } });
                } else {
                    this.setState({ pagination: { currentPage } });
                }
            },
            setPagination: pagination => this.setState({ pagination }),
            setGroups: groups => this.setState({ groups }),
            setDataSource: dataSource => this.setState({ dataSource }),
            setExpandedRowKeys: expandedRowKeys => this.setState({ expandedRowKeys: [...expandedRowKeys] }),
            setQuery: (query = {}) => {
                let queries = [...this.state.queries];
                queries = mergeQueries(query, queries);
                this.setState({ queries });
            },
            // Update queries when filtering or sorting
            setQueries: (queries: ColumnProps<RecordType>[]) => this.setState({ queries }),
            setFlattenData: flattenData => this.setState({ flattenData }),
            setAllRowKeys: allRowKeys => this.setState({ allRowKeys }),
            setHoveredRowKey: hoveredRowKey => {
                this.store.setState({ hoveredRowKey });
            },
            setCachedFilteredSortedDataSource: filteredSortedDataSource => {
                this.cachedFilteredSortedDataSource = filteredSortedDataSource;
            },
            setCachedFilteredSortedRowKeys: filteredSortedRowKeys => {
                this.cachedFilteredSortedRowKeys = filteredSortedRowKeys;
                this.cachedFilteredSortedRowKeysSet = new Set(filteredSortedRowKeys);
            },
            setAllDisabledRowKeys: allDisabledRowKeys => {
                const allDisabledRowKeysSet = new Set(allDisabledRowKeys);
                this.setState({ allDisabledRowKeys, allDisabledRowKeysSet });
            },
            getCurrentPage: () => get(this.state, 'pagination.currentPage', 1),
            getCurrentPageSize: () => get(this.state, 'pagination.pageSize', numbers.DEFAULT_PAGE_SIZE),
            getCachedFilteredSortedDataSource: () => this.cachedFilteredSortedDataSource,
            getCachedFilteredSortedRowKeys: () => this.cachedFilteredSortedRowKeys,
            getCachedFilteredSortedRowKeysSet: () => this.cachedFilteredSortedRowKeysSet,
            getAllDisabledRowKeys: () => this.state.allDisabledRowKeys,
            getAllDisabledRowKeysSet: () => this.state.allDisabledRowKeysSet,
            notifyFilterDropdownVisibleChange: (visible, dataIndex) =>
                this._invokeColumnFn(dataIndex, 'onFilterDropdownVisibleChange', visible),
            notifyChange: (...args) => this.props.onChange(...args),
            notifyExpand: (...args) => this.props.onExpand(...args),
            notifyExpandedRowsChange: (...args) => this.props.onExpandedRowsChange(...args),
            notifySelect: (...args) => this._invokeRowSelection('onSelect', ...args),
            notifySelectAll: (...args) => this._invokeRowSelection('onSelectAll', ...args),
            notifySelectInvert: (...args) => this._invokeRowSelection('onSelectInvert', ...args),
            notifySelectionChange: (...args) => this._invokeRowSelection('onChange', ...args),
            isAnyColumnFixed: (columns: ColumnProps<RecordType>[]) =>
                some(this.getColumns(columns || this.props.columns, this.props.children), column => Boolean(column.fixed)),
            useFixedHeader: () => {
                const { scroll, sticky } = this.props;

                if (get(scroll, 'y')) {
                    return true;
                }

                if (sticky) {
                    return true;
                }

                return false;
            },
            getTableLayout: () => {
                let isFixed = false;
                const { flattenColumns } = this.state;

                if (Array.isArray(flattenColumns)) {
                    isFixed = flattenColumns.some(column => (Boolean(column.ellipsis) || Boolean(column.fixed)));
                }

                if (this.adapter.useFixedHeader()) {
                    isFixed = true;
                }

                return isFixed ? 'fixed' : 'auto';
            },
            setHeadWidths: (headWidths: Array<BaseHeadWidth>, index = 0) => {
                if (!equalWith(this.state.headWidths[index], headWidths)) {
                    // The map call depends on the last state
                    this.setState(state => {
                        const newHeadWidths: Array<Array<BaseHeadWidth>> = [...state.headWidths];
                        newHeadWidths[index] = [...headWidths];
                        return { headWidths: newHeadWidths };
                    });
                }
            },
            getHeadWidths: (index = 0) => {
                if (this.state.headWidths.length && typeof index === 'number') {
                    const configs = this.state.headWidths[index] || [];
                    return configs.map(item => item.width);
                }
                return [];
            },
            // This method is called by row rendering function
            getCellWidths: (flattenedColumns: ColumnProps<RecordType>[], flattenedWidths: BaseHeadWidth[] = null, ignoreScrollBarKey = false): number[] => {
                if (Array.isArray(flattenedColumns) && flattenedColumns.length) {
                    flattenedWidths =
                        flattenedWidths == null && this.state.headWidths.length ?
                            flattenDeep(this.state.headWidths) :
                            [];
                    if (
                        Array.isArray(flattenedWidths) &&
                        flattenedWidths.length
                    ) {
                        return flattenedColumns.reduce((result, column) => {
                            const found =
                                column.key === strings.DEFAULT_KEY_COLUMN_SCROLLBAR && ignoreScrollBarKey ?
                                    null :
                                    find(
                                        flattenedWidths,
                                        item => item && item.key != null && item.key === column.key
                                    );
                            if (found) {
                                result.push(found.width);
                            }

                            return result;
                        }, [] as number[]);
                    }
                }
                return [];
            },
            mergedRowExpandable: record => {
                const { expandedRowRender, childrenRecordName, rowExpandable } = this.props;
                const children = get(record, childrenRecordName);
                const hasExpandedRowRender = typeof expandedRowRender === 'function';
                const hasRowExpandable = typeof rowExpandable === 'function';
                const hasChildren = Array.isArray(children) && children.length;
                const strictExpandableResult = hasRowExpandable && rowExpandable(record);
                const looseExpandableResult = !hasRowExpandable || strictExpandableResult;

                return (
                    ((hasExpandedRowRender || hasChildren) && looseExpandableResult) ||
                    (!(hasExpandedRowRender || hasChildren) && strictExpandableResult)
                );
            },
            isAnyColumnUseFullRender: (columns: ColumnProps<RecordType>[]) =>
                some(columns, column => Boolean(column.useFullRender)),
            getNormalizeColumns: () => this.normalizeColumns,
            getHandleColumns: () => this.handleColumns,
            getMergePagination: () => this.mergePagination,
            setBodyHasScrollbar: bodyHasScrollBar => {
                if (bodyHasScrollBar !== this.state.bodyHasScrollBar) {
                    this.setState({ bodyHasScrollBar });
                }
            },
            stopPropagation(e: TableSelectionCellEvent) {
                // The event definition here is not very accurate for now, it belongs to a broad structure definition
                if (e && typeof e === 'object') {
                    if (typeof e.stopPropagation === 'function') {
                        e.stopPropagation();
                    }
                    if (e.nativeEvent && typeof e.nativeEvent.stopPropagation === 'function') {
                        e.nativeEvent.stopPropagation();
                    } else if (typeof e.stopImmediatePropagation === 'function') {
                        e.stopImmediatePropagation();
                    }
                }
            }
        };
    }

    bodyWrapRef: React.MutableRefObject<HTMLDivElement>;
    rootWrapRef: React.MutableRefObject<HTMLDivElement>;
    wrapRef: React.MutableRefObject<HTMLDivElement>;
    headerWrapRef: React.MutableRefObject<HTMLDivElement>;
    debouncedWindowResize: () => void;
    cachedFilteredSortedDataSource: RecordType[];
    cachedFilteredSortedRowKeys: BaseRowKeyType[];
    cachedFilteredSortedRowKeysSet: Set<string | number>;
    store: Store;
    lastScrollTop!: number;
    lastScrollLeft!: number;
    scrollPosition!: BodyScrollPosition;
    position!: BodyScrollPosition;
    foundation: TableFoundation<RecordType>;
    context: TableContextProps;
    constructor(props: NormalTableProps<RecordType>, context: TableContextProps) {
        super(props);
        this.foundation = new TableFoundation<RecordType>(this.adapter);
        // columns cannot be deepClone, otherwise the comparison will be false
        const columns = this.getColumns(props.columns, props.children);
        const cachedflattenColumns = flattenColumns(columns);
        const queries = TableFoundation.initColumnsFilteredValueAndSorterOrder(cloneDeep(cachedflattenColumns));
        const filteredSortedDataSource = this.foundation.getFilteredSortedDataSource(this.props.dataSource, queries);
        const newPagination = isPlainObject(this.props.pagination) ? this.props.pagination : {} as any;
        const pageData: BasePageData<RecordType> = this.foundation.getCurrentPageData(filteredSortedDataSource, newPagination, queries);
        this.state = {
            /**
             * Cached props
             */
            cachedColumns: columns, // update cachedColumns after columns or children change
            cachedChildren: props.children,
            flattenColumns: cachedflattenColumns,
            components: mergeComponents(props.components, props.virtualized), // cached components

            /**
             * State calculated based on prop
             */
            queries, // flatten columns, update when sorting or filtering
            dataSource: pageData.dataSource, // data after paging
            flattenData: [],
            expandedRowKeys: [...(props.expandedRowKeys || []), ...(props.defaultExpandedRowKeys || [])], // cached expandedRowKeys
            rowSelection: props.rowSelection ? isObject(props.rowSelection) ? { ...props.rowSelection } : {} : null,
            pagination: pageData.pagination,
            /**
             * Internal state
             */
            groups: null,
            allRowKeys: [], // row keys after paging
            disabledRowKeys: [], // disabled row keys after paging
            disabledRowKeysSet: new Set(),
            allDisabledRowKeys: [],
            allDisabledRowKeysSet: new Set(),
            headWidths: [], // header cell width
            bodyHasScrollBar: false,
            prePropRowSelection: undefined,
            prePagination: undefined
        };

        this.rootWrapRef = createRef();
        this.wrapRef = createRef(); // table's outside wrap

        this.bodyWrapRef = createRef();
        this.headerWrapRef = createRef();

        this.store = new Store({
            hoveredRowKey: null,
        });

        this.debouncedWindowResize = debounce(this.handleWindowResize, 150);

        this.cachedFilteredSortedDataSource = [];
        this.cachedFilteredSortedRowKeys = [];
        this.cachedFilteredSortedRowKeysSet = new Set();
    }

    static getDerivedStateFromProps(props: NormalTableProps, state: NormalTableState) {
        const willUpdateStates: Partial<NormalTableState> = {};
        const { rowSelection, dataSource, childrenRecordName, rowKey, pagination } = props;
        props.columns && props.children && logger.warn('columns should not given by object and children at the same time');

        if (props.columns && props.columns !== state.cachedColumns) {
            const newFlattenColumns = flattenColumns(props.columns);
            willUpdateStates.flattenColumns = newFlattenColumns;
            willUpdateStates.queries = mergeColumns(state.queries, newFlattenColumns, null, false);
            willUpdateStates.cachedColumns = props.columns;
            willUpdateStates.cachedChildren = null;
        } else if (props.children && props.children !== state.cachedChildren) {
            const newNestedColumns = getColumns(props.children);
            const newFlattenColumns = flattenColumns(newNestedColumns);
            const columns = mergeColumns(state.queries, newFlattenColumns, null, false);
            willUpdateStates.flattenColumns = newFlattenColumns;
            willUpdateStates.queries = [...columns];
            willUpdateStates.cachedColumns = [...newNestedColumns];
            willUpdateStates.cachedChildren = props.children;
        }

        // Update controlled selection column
        if (rowSelection !== state.prePropRowSelection) {
            let newSelectionStates: TableStateRowSelection = {};
            if (isObject(state.rowSelection)) {
                newSelectionStates = { ...newSelectionStates, ...state.rowSelection };
            }
            if (isObject(rowSelection)) {
                newSelectionStates = { ...newSelectionStates, ...rowSelection };
            }
            const selectedRowKeys = get(rowSelection, 'selectedRowKeys');
            const getCheckboxProps = get(rowSelection, 'getCheckboxProps');
            if (selectedRowKeys && Array.isArray(selectedRowKeys)) {
                newSelectionStates.selectedRowKeysSet = new Set(selectedRowKeys);
            }
            // The return value of getCheckboxProps affects the disabled rows
            if (isFunction(getCheckboxProps)) {
                const disabledRowKeys = getAllDisabledRowKeys({ dataSource, getCheckboxProps, childrenRecordName, rowKey });
                const disabledRowKeysSet = new Set(disabledRowKeys);
                willUpdateStates.disabledRowKeys = disabledRowKeys;
                willUpdateStates.disabledRowKeysSet = disabledRowKeysSet;
                willUpdateStates.allDisabledRowKeys = disabledRowKeys;
                willUpdateStates.allDisabledRowKeysSet = disabledRowKeysSet;
            }
            willUpdateStates.rowSelection = newSelectionStates;
            willUpdateStates.prePropRowSelection = rowSelection;
        }
        if (pagination !== state.prePagination) {
            let newPagination: Pagination = {};
            if (isObject(state.pagination)) {
                newPagination = { ...newPagination, ...state.pagination };
            }
            if (isObject(pagination)) {
                newPagination = { ...newPagination, ...pagination };
            }
            willUpdateStates.pagination = newPagination;
            willUpdateStates.prePagination = pagination;
        }
        return willUpdateStates;
    }

    componentDidMount() {
        super.componentDidMount();
        this.setScrollPosition('left');

        if (this.adapter.isAnyColumnFixed() || (this.props.showHeader && this.adapter.useFixedHeader())) {
            this.handleWindowResize();
            window.addEventListener('resize', this.debouncedWindowResize);
        }
    }

    // TODO: Extract the setState operation to the adapter or getDerivedStateFromProps function
    componentDidUpdate(prevProps: NormalTableProps<RecordType>, prevState: NormalTableState<RecordType>) {
        const {
            dataSource,
            expandedRowKeys,
            expandAllRows,
            expandAllGroupRows,
            virtualized,
            components,
            pagination: propsPagination
        } = this.props;

        const {
            pagination: statePagination,
            queries: stateQueries,
            cachedColumns: stateCachedColumns,
            cachedChildren: stateCachedChildren,
            groups: stateGroups,
        } = this.state;

        /**
         * State related to paging
         *
         * @param dataSource
         * @param groups
         * @param pagination
         * @param disabledRowKeys
         * @param allRowKeys
         * @param queries
         */
        const states: Partial<NormalTableState<RecordType>> = {};

        this._warnIfNoKey();

        /**
         * The state that needs to be updated after props changes
         */

        // Update controlled expand column
        if (Array.isArray(expandedRowKeys) && expandedRowKeys !== prevProps.expandedRowKeys) {
            this.setState({ expandedRowKeys });
        }

        // Update components
        if (components !== prevProps.components || virtualized !== prevProps.virtualized) {
            this.setState({ components: mergeComponents(components, virtualized) });
        }

        // Update the default expanded column
        if (
            expandAllRows !== prevProps.expandAllRows ||
            expandAllGroupRows !== prevProps.expandAllGroupRows
        ) {
            this.foundation.initExpandedRowKeys({ groups: stateGroups });
        }

        /**
         * After dataSource is updated || (cachedColumns || cachedChildren updated)
         * 1. Cache filtered sorted data and a collection of data rows, stored in this
         * 2. Update pager and group, stored in state
         */
        if (dataSource !== prevProps.dataSource || stateCachedColumns !== prevState.cachedColumns || stateCachedChildren !== prevState.cachedChildren) {
            // TODO: foundation.getFilteredSortedDataSource has side effects and will be modified to the dataSource reference
            // Temporarily use _dataSource=[...dataSource] for processing
            const _dataSource = [...dataSource];
            const filteredSortedDataSource = this.foundation.getFilteredSortedDataSource(_dataSource, stateQueries);
            const allDataDisabledRowKeys = this.foundation.getAllDisabledRowKeys(filteredSortedDataSource);
            this.foundation.setCachedFilteredSortedDataSource(filteredSortedDataSource);
            this.foundation.setAllDisabledRowKeys(allDataDisabledRowKeys);
            states.dataSource = filteredSortedDataSource;

            if (this.props.groupBy) {
                states.groups = null;
            }
        }

        // when dataSource has change, should reset currentPage
        if (dataSource !== prevProps.dataSource) {
            states.pagination = isObject(statePagination) ? {
                ...statePagination,
                currentPage: isObject(propsPagination) && propsPagination.currentPage ? propsPagination.currentPage : 1,
            } : statePagination;
        }

        if (Object.keys(states).length) {
            const {
                pagination: mergedStatePagination = null,
                queries: stateQueries = null,
                dataSource: stateDataSource = null,
            } = states;
            const handledProps: Partial<NormalTableState<RecordType>> = this.foundation.getCurrentPageData(stateDataSource, mergedStatePagination as TablePaginationProps, stateQueries);

            // After the pager is updated, reset allRowKeys of the current page
            this.adapter.setAllRowKeys(handledProps.allRowKeys);
            this.adapter.setDisabledRowKeys(handledProps.disabledRowKeys);

            if ('dataSource' in states) {
                if (this.props.defaultExpandAllRows && handledProps.groups && handledProps.groups.size ||
                    this.props.expandAllRows ||
                    this.props.expandAllGroupRows
                ) {
                    this.foundation.initExpandedRowKeys(handledProps);
                }
                states.pagination = handledProps.pagination;
            }

            // Centrally update paging related state
            const statesKeys: any[] = Object.keys(states);
            for (const k of statesKeys) {
                this.setState({ [k]: handledProps[k] });
            }
        }

        if (this.adapter.isAnyColumnFixed() || (this.props.showHeader && this.adapter.useFixedHeader())) {
            if (!this.debouncedWindowResize) {
                window.addEventListener('resize', this.debouncedWindowResize);
            }
        }
    }

    componentWillUnmount() {
        super.componentWillUnmount();

        if (this.debouncedWindowResize) {
            window.removeEventListener('resize', this.debouncedWindowResize);
            (this.debouncedWindowResize as any).cancel();
            this.debouncedWindowResize = null;
        }
    }

    // TODO: notify when data don't have key
    _warnIfNoKey = () => {
        if (
            (this.props.rowSelection || this.props.expandedRowRender) &&
            some(this.props.dataSource, record => this.foundation.getRecordKey(record) == null)
        ) {
            logger.error(
                'You must specify a key for each element in the dataSource or use "rowKey" to specify an attribute name as the primary key!'
            );
        }
    };

    _invokeRowSelection = (funcName: string, ...args: any[]) => {
        const func = get(this.state, ['rowSelection', funcName]);

        if (typeof func === 'function') {
            func(...args);
        }
    };

    _invokeColumnFn = (key: string, funcName: string, ...args: any[]) => {
        if (key && funcName) {
            const column = this.foundation.getQuery(key);
            const func = get(column, funcName, null);

            if (typeof func === 'function') {
                func(...args);
            }
        }
    };

    _cacheHeaderRef = (node: HTMLDivElement) => {
        this.headerWrapRef.current = node;
    };

    getCurrentPageData = () => {
        const pageData = this.foundation.getCurrentPageData();
        const retObj: Pick<BasePageData<RecordType>, 'dataSource' | 'groups'> = ['dataSource', 'groups'].reduce((result, key) => {
            if (pageData[key]) {
                result[key] = pageData[key];
            }
            return result;
        }, {});

        return cloneDeep(retObj);
    };

    getColumns = (columns: ColumnProps<RecordType>[], children: ReactNode) => (!Array.isArray(columns) || !columns || !columns.length ? getColumns(children) : columns);

    // @ts-ignore
    getCellWidths = (...args: any[]) => this.foundation.getCellWidths(...args);
    // @ts-ignore
    setHeadWidths = (...args: any[]) => this.foundation.setHeadWidths(...args);
    // @ts-ignore
    getHeadWidths = (...args: any[]) => this.foundation.getHeadWidths(...args);
    // @ts-ignore
    mergedRowExpandable = (...args: any[]) => this.foundation.mergedRowExpandable(...args);
    // @ts-ignore
    setBodyHasScrollbar = (...args: any[]) => this.foundation.setBodyHasScrollbar(...args);

    handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        const { scroll = {} } = this.props;
        if (window.navigator.userAgent.match(/Trident\/7\./) && scroll.y) {
            event.preventDefault();
            const wd = event.deltaY;
            const { target } = event;
            // const { bodyTable, fixedColumnsBodyLeft, fixedColumnsBodyRight } = this;
            const bodyTable = this.bodyWrapRef.current;

            let scrollTop = 0;

            if (this.lastScrollTop) {
                scrollTop = this.lastScrollTop + wd;
            } else {
                scrollTop = wd;
            }

            if (bodyTable && target !== bodyTable) {
                bodyTable.scrollTop = scrollTop;
            }
        }
    };

    handleBodyScrollLeft = (e: BodyScrollEvent) => {
        if (e.currentTarget !== e.target) {
            return;
        }
        const { target } = e;
        // const { headTable, bodyTable } = this;
        const headTable = this.headerWrapRef.current;
        const bodyTable = this.bodyWrapRef.current;
        if (target.scrollLeft !== this.lastScrollLeft) {
            if (target === bodyTable && headTable) {
                headTable.scrollLeft = target.scrollLeft;
            } else if (target === headTable && bodyTable) {
                bodyTable.scrollLeft = target.scrollLeft;
            }
            this.setScrollPositionClassName();
        }
        // Remember last scrollLeft for scroll direction detecting.
        this.lastScrollLeft = target.scrollLeft;
    };

    handleWindowResize = () => {
        this.syncTableWidth();
        this.setScrollPositionClassName();
    };

    handleBodyScrollTop = (e: BodyScrollEvent) => {
        const { target } = e;
        if (e.currentTarget !== target) {
            return;
        }
        const { scroll = {} } = this.props;
        // const { headTable, bodyTable, fixedColumnsBodyLeft, fixedColumnsBodyRight } = this;
        const headTable = this.headerWrapRef.current;
        const bodyTable = this.bodyWrapRef.current;

        if (target.scrollTop !== this.lastScrollTop && scroll.y && target !== headTable) {
            const { scrollTop } = target;

            if (bodyTable && target !== bodyTable) {
                bodyTable.scrollTop = scrollTop;
            }
        }
        // Remember last scrollTop for scroll direction detecting.
        this.lastScrollTop = target.scrollTop;
    };

    handleBodyScroll = (e: BodyScrollEvent) => {
        this.handleBodyScrollLeft(e);
        this.handleBodyScrollTop(e);
    };

    setScrollPosition = (position: BodyScrollPosition) => {
        const { prefixCls } = this.props;
        const positionAll = [
            `${prefixCls}-scroll-position-both`,
            `${prefixCls}-scroll-position-middle`,
            `${prefixCls}-scroll-position-left`,
            `${prefixCls}-scroll-position-right`,
        ];
        this.scrollPosition = position;
        const tableNode = this.wrapRef.current;
        if (tableNode && tableNode.nodeType) {
            if (position === 'both') {
                const acceptPosition = [`${prefixCls}-scroll-position-left`, `${prefixCls}-scroll-position-right`];
                tableNode.classList.remove(...difference(positionAll, acceptPosition));
                tableNode.classList.add(...acceptPosition);
            } else {
                const acceptPosition = [`${prefixCls}-scroll-position-${position}`];
                tableNode.classList.remove(...difference(positionAll, acceptPosition));
                tableNode.classList.add(...acceptPosition);
            }
        }
    };

    setScrollPositionClassName = () => {
        const node = this.bodyWrapRef.current;
        if (node && node.children && node.children.length) {
            const scrollToLeft = node.scrollLeft === 0;
            // why use Math.abs? @see https://bugzilla.mozilla.org/show_bug.cgi?id=1447743
            const scrollToRight =
                Math.abs(node.scrollLeft) + 1 >=
                node.children[0].getBoundingClientRect().width - node.getBoundingClientRect().width;
            if (scrollToLeft && scrollToRight) {
                this.setScrollPosition('both');
            } else if (scrollToLeft) {
                this.setScrollPosition('left');
            } else if (scrollToRight) {
                this.setScrollPosition('right');
            } else if (this.scrollPosition !== 'middle') {
                this.setScrollPosition('middle');
            }
        }
    };

    syncTableWidth = () => {
        if (this.rootWrapRef && this.rootWrapRef.current) {
            this.setState({ tableWidth: this.rootWrapRef.current.getBoundingClientRect().width });
        }
    };

    renderSelection = (record = {} as any, inHeader = false, index?: number): React.ReactNode => {
        const { rowSelection, allDisabledRowKeysSet } = this.state;

        if (rowSelection && typeof rowSelection === 'object') {
            const {
                selectedRowKeys = [],
                selectedRowKeysSet = new Set(),
                getCheckboxProps,
                disabled,
                renderCell,
            } = rowSelection;

            const allRowKeys = this.cachedFilteredSortedRowKeys;
            const allRowKeysSet = this.cachedFilteredSortedRowKeysSet;
            const allIsSelected = this.foundation.allIsSelected(selectedRowKeysSet, allDisabledRowKeysSet, allRowKeys);
            const hasRowSelected = this.foundation.hasRowSelected(selectedRowKeys, allRowKeysSet);
            const indeterminate = hasRowSelected && !allIsSelected;

            if (inHeader) {
                const columnKey = get(rowSelection, 'key', strings.DEFAULT_KEY_COLUMN_SELECTION);

                const originNode = (
                    <ColumnSelection
                        aria-label={`${allIsSelected ? 'Deselect' : 'Select'} all rows`}
                        disabled={disabled}
                        key={columnKey}
                        selected={allIsSelected}
                        indeterminate={indeterminate}
                        onChange={(selected, e) => {
                            this.toggleSelectAllRow(selected, e);
                        }}
                    />
                );

                const selectAll = (selected: boolean, e: Event) =>
                    this.toggleSelectAllRow(selected, e as TableSelectionCellEvent);

                return isFunction(renderCell)
                    ? renderCell({
                        selected: allIsSelected,
                        record,
                        originNode,
                        inHeader,
                        disabled,
                        indeterminate,
                        selectAll,
                    })
                    : originNode;
            } else {
                const key = this.foundation.getRecordKey(record);
                const selected = selectedRowKeysSet.has(key);
                const checkboxPropsFn = () => (typeof getCheckboxProps === 'function' ? getCheckboxProps(record) : {});
                const originNode = (
                    <ColumnSelection
                        aria-label={`${selected ? 'Deselect' : 'Select'} this row`}
                        getCheckboxProps={checkboxPropsFn}
                        selected={selected}
                        onChange={(status, e) => this.toggleSelectRow(status, key, e)}
                    />
                );
                const selectRow = (selected: boolean, e: Event) =>
                    this.toggleSelectRow(selected, key, e as TableSelectionCellEvent);

                return isFunction(renderCell)
                    ? renderCell({
                        selected,
                        record,
                        index,
                        originNode,
                        inHeader: false,
                        disabled,
                        indeterminate,
                        selectRow,
                    })
                    : originNode;
            }
        }
        return null;
    };

    renderRowSelectionCallback = (text: string, record: RecordType = {} as RecordType, index: number) => this.renderSelection(record, false, index);
    renderTitleSelectionCallback = () => this.renderSelection(undefined, true);

    normalizeSelectionColumn = (props: { rowSelection?: TableStateRowSelection<RecordType>; prefixCls?: string } = {}) => {
        const { rowSelection, prefixCls } = props;
        let column: ColumnProps = {};
        if (rowSelection) {
            const needOmitSelectionKey = ['selectedRowKeys', 'selectedRowKeysSet'];
            column = { key: strings.DEFAULT_KEY_COLUMN_SELECTION };

            if (isObject(rowSelection)) {
                column = { ...column, ...omit(rowSelection, needOmitSelectionKey) };
            }

            column.className = classnames(column.className, `${prefixCls}-column-selection`);

            column.title = this.renderTitleSelectionCallback;

            column.render = this.renderRowSelectionCallback;
        }
        return column;
    };

    // If there is a scroll bar, manually construct a column and insert it into the header
    normalizeScrollbarColumn = (props: { scrollbarWidth?: number } = {}): { key: 'column-scrollbar'; width: number; fixed: 'right' } => {
        const { scrollbarWidth = 0 } = props;

        return {
            key: strings.DEFAULT_KEY_COLUMN_SCROLLBAR as 'column-scrollbar',
            width: scrollbarWidth,
            fixed: 'right',
        };
    };

    /**
     * render expand icon
     * @param {Object} record
     * @param {Boolean} isNested
     * @param {String} groupKey
     * @returns {ReactNode}
     */
    renderExpandIcon = (record = {}, isNested = false, groupKey: string | number = null) => {
        const { expandedRowKeys } = this.state;
        const { expandIcon } = this.props;
        const key =
            typeof groupKey === 'string' || typeof groupKey === 'number' ?
                groupKey :
                this.foundation.getRecordKey(record as RecordType);

        return (
            <ExpandedIcon
                key={key}
                componentType={isNested ? 'tree' : 'expand'}
                expanded={includes(expandedRowKeys, key)}
                expandIcon={expandIcon}
                onClick={(expanded, e) => this.handleRowExpanded(expanded, key, e)}
            />
        );
    };

    // @ts-ignore
    handleRowExpanded = (...args: any[]) => this.foundation.handleRowExpanded(...args);

    normalizeExpandColumn = (props: { prefixCls?: string; expandCellFixed?: ArrayElement<typeof strings.FIXED_SET>; expandIcon?: ExpandIcon } = {}) => {
        let column: ColumnProps = null;

        const { prefixCls, expandCellFixed, expandIcon } = props;

        column = { fixed: expandCellFixed, key: strings.DEFAULT_KEY_COLUMN_EXPAND };

        column.className = classnames(column.className, `${prefixCls}-column-expand`);

        column.render =
            expandIcon !== false ?
                (text = '', record, index) =>
                    (this.adapter.mergedRowExpandable(record) ? this.renderExpandIcon(record) : null) :
                () => null;

        return column;
    };

    /**
      * Add sorting, filtering, and rendering functions to columns, and add column event handling
      * Title support function, passing parameters as {filter: node, sorter: node, selection: node}
      * @param {*} column
      */
    addFnsInColumn = (column: ColumnProps = {}) => {
        const { prefixCls } = this.props;
        if (column && (column.sorter || column.filters || column.onFilter || column.useFullRender)) {
            let hasSorter = typeof column.sorter === 'function' || column.sorter === true;
            let hasFilter = (Array.isArray(column.filters) && column.filters.length) ||
                isValidElement(column.filterDropdown) ||
                typeof column.renderFilterDropdown === 'function';
            let hasSorterOrFilter = false;
            const sortOrderNotControlled = !('sortOrder' in column);
            const showSortTip = sortOrderNotControlled && column.showSortTip === true;
            const { dataIndex, title: rawTitle, useFullRender } = column;
            const clickColumnToSorter = hasSorter && !hasFilter && !Boolean(useFullRender);
            const curQuery = this.foundation.getQuery(dataIndex);
            const titleMap: ColumnTitleProps = {};
            const titleArr = [];

            // useFullRender adds select buttons to each column
            if (useFullRender) {
                titleMap.selection = this.renderSelection(null, true);
            }

            const stateSortOrder = get(curQuery, 'sortOrder');
            const defaultSortOrder = get(curQuery, 'defaultSortOrder', false);
            const sortOrder = this.foundation.isSortOrderValid(stateSortOrder) ? stateSortOrder : defaultSortOrder;
            const showEllipsisTitle = shouldShowEllipsisTitle(column.ellipsis);
            const TitleNode = typeof rawTitle !== 'function' && (
                <span
                    className={`${prefixCls}-row-head-title`}
                    key={strings.DEFAULT_KEY_COLUMN_TITLE}
                    title={showEllipsisTitle && typeof rawTitle === 'string' ? rawTitle : undefined}
                >
                    {rawTitle as React.ReactNode}
                </span>
            );
            if (hasSorter) {
                // In order to increase the click hot area of ​​sorting, when sorting is required & useFullRender is false,
                // both the title and sorting areas are used as the click hot area for sorting。
                const sorter = (
                    <ColumnSorter
                        key={strings.DEFAULT_KEY_COLUMN_SORTER}
                        sortOrder={sortOrder}
                        sortIcon={column.sortIcon}
                        onClick={useFullRender || hasFilter ? e => this.foundation.handleSort(column, e) : null}
                        title={TitleNode}
                        showTooltip={!clickColumnToSorter && showSortTip}
                    />
                );
                useFullRender && (titleMap.sorter = sorter);
                hasSorterOrFilter = true;
                titleArr.push(sorter);
            } else {
                titleArr.push(TitleNode);
            }

            const stateFilteredValue = get(curQuery, 'filteredValue');
            const defaultFilteredValue = get(curQuery, 'defaultFilteredValue');
            const filteredValue = stateFilteredValue ? stateFilteredValue : defaultFilteredValue;
            if (hasFilter) {

                const filter = (
                    <ColumnFilter
                        key={strings.DEFAULT_KEY_COLUMN_FILTER}
                        {...omit(curQuery, 'children')}
                        filteredValue={filteredValue}
                        onFilterDropdownVisibleChange={(visible: boolean) =>
                            this.foundation.toggleShowFilter(dataIndex, visible)
                        }
                        onSelect={(data: OnSelectData) => this.foundation.handleFilterSelect(dataIndex, data)}
                    />
                );
                useFullRender && (titleMap.filter = filter);
                hasSorterOrFilter = true;
                titleArr.push(filter);
            }

            const newTitle =
                typeof rawTitle === 'function' ? (
                    () => rawTitle(titleMap)
                ) : hasSorterOrFilter ? (
                    <div className={`${prefixCls}-operate-wrapper`}>{titleArr}</div>
                ) : (
                    titleArr
                );

            column = { ...column, title: newTitle };
            if (clickColumnToSorter) {
                column.clickToSort = e => {
                    this.foundation.handleSort(column, e, true);
                };
                column.mouseDown = this.foundation.handleMouseDown;
                column.sortOrder = sortOrder;
                column.showSortTip = showSortTip;
            }
        }

        return column;
    };

    toggleSelectRow = (selected: boolean, realKey: string | number, e: TableSelectionCellEvent) => {
        this.foundation.handleSelectRow(realKey, selected, e);
    };

    toggleSelectAllRow = (selected: boolean, e: TableSelectionCellEvent) => {
        this.foundation.handleSelectAllRow(selected, e);
    };

    /**
     * render pagination
     * @param {object} pagination
     * @param {object} propRenderPagination
     */
    renderPagination = (pagination: TablePaginationProps, propRenderPagination: RenderPagination) => {
        if (!pagination) {
            return null;
        }

        // use memoized pagination
        const mergedPagination = this.foundation.memoizedPagination(pagination);

        return (
            <LocaleConsumer componentName="Table">
                {(locale: TableLocale) => {
                    const info = this.foundation.formatPaginationInfo(mergedPagination, locale.pageText);
                    return <TablePagination info={info} pagination={mergedPagination} renderPagination={propRenderPagination} />;
                }}
            </LocaleConsumer>
        );
    };

    renderTitle = (props: { title?: ReactNode | ((dataSource?: RecordType[]) => ReactNode); prefixCls?: string; dataSource?: any[] } = {}) => {
        let { title } = props;
        const { prefixCls, dataSource } = props;

        if (typeof title === 'function') {
            title = title(dataSource);
        }

        return isValidElement(title) || typeof title === 'string' ? (
            <div className={`${prefixCls}-title`} x-semi-prop="title">{title}</div>
        ) : null;
    };

    renderEmpty = (props: { prefixCls?: string; empty?: ReactNode; dataSource?: RecordType[] } = {}) => {
        const { prefixCls, empty, dataSource } = props;
        const wrapCls = `${prefixCls}-placeholder`;
        const isEmpty = this.foundation.isEmpty(dataSource);

        if (!isEmpty) {
            return null;
        }

        return (
            <LocaleConsumer componentName="Table" key={'emptyText'}>
                {(locale: TableLocale, localeCode: string) => (
                    <div className={wrapCls}>
                        <div className={`${prefixCls}-empty`} x-semi-prop="empty">
                            {empty || locale.emptyText}
                        </div>
                    </div>
                )}
            </LocaleConsumer>
        );
    };

    renderFooter = (props: { footer?: ReactNode | ((dataSource?: RecordType[]) => ReactNode); prefixCls?: string; dataSource?: RecordType[] } = {}) => {
        let { footer } = props;
        const { prefixCls, dataSource } = props;

        if (typeof footer === 'function') {
            footer = footer(dataSource);
        }

        return isValidElement(footer) || typeof footer === 'string' ? (
            <div className={`${prefixCls}-footer`} key="footer" x-semi-prop="footer">
                {footer}
            </div>
        ) : null;
    };

    renderMainTable = (props: any) => {
        const useFixedHeader = this.adapter.useFixedHeader();
        const emptySlot = this.renderEmpty(props);

        const table = [
            this.renderTable({
                ...props,
                fixed: false,
                useFixedHeader,
                headerRef: this._cacheHeaderRef,
                bodyRef: this.bodyWrapRef,
                includeHeader: !useFixedHeader,
                emptySlot
            }),
            this.renderFooter(props),
        ];

        return table;
    };


    renderTable = (props: RenderTableProps<RecordType>) => {
        const {
            columns,
            filteredColumns,
            fixed,
            useFixedHeader,
            scroll,
            prefixCls,
            anyColumnFixed,
            includeHeader,
            showHeader,
            components,
            headerRef,
            bodyRef,
            onHeaderRow,
            rowSelection,
            dataSource,
            bodyHasScrollBar,
            disabledRowKeysSet,
            sticky,
        } = props;
        const selectedRowKeysSet = get(rowSelection, 'selectedRowKeysSet', new Set());
        const tableLayout = this.adapter.getTableLayout();

        const headTable =
            fixed || useFixedHeader ? (
                <HeadTable
                    key="head"
                    tableLayout={tableLayout}
                    ref={headerRef}
                    columns={filteredColumns}
                    prefixCls={prefixCls}
                    fixed={fixed}
                    handleBodyScroll={this.handleBodyScrollLeft}
                    components={components}
                    scroll={scroll}
                    showHeader={showHeader}
                    selectedRowKeysSet={selectedRowKeysSet}
                    onHeaderRow={onHeaderRow}
                    dataSource={dataSource}
                    bodyHasScrollBar={bodyHasScrollBar}
                    sticky={sticky}
                />
            ) : null;

        const bodyTable = (
            <BodyTable
                {...omit(props, ['rowSelection', 'headWidths']) as any}
                key="body"
                ref={bodyRef}
                columns={filteredColumns}
                fixed={fixed}
                prefixCls={prefixCls}
                handleWheel={this.handleWheel}
                handleBodyScroll={this.handleBodyScroll}
                anyColumnFixed={anyColumnFixed}
                tableLayout={tableLayout}
                includeHeader={includeHeader}
                showHeader={showHeader}
                scroll={scroll}
                components={components}
                store={this.store}
                selectedRowKeysSet={selectedRowKeysSet}
                disabledRowKeysSet={disabledRowKeysSet}
            />
        );

        return [headTable, bodyTable];
    };

    /**
     * When columns change, call this function to get the latest withFnsColumns
     * In addition to changes in columns, these props changes must be recalculated
     *  - hideExpandedColumn
     *  -rowSelection changes from trusy to falsy or rowSelection.hidden changes
     *  -isAnyFixedRight(columns) || get(scroll,'y') changes
     *
     * columns变化时，调用此函数获取最新的withFnsColumns
     * 除了 columns 变化，这些 props 变化也要重新计算
     *  - hideExpandedColumn
     *  - rowSelection 从 trusy 变为 falsy 或 rowSelection.hidden 发生变化
     *  - isAnyFixedRight(columns) || get(scroll, 'y') 发生变化
     *
     * @param {Array} queries
     * @param {Array} cachedColumns
     * @returns columns after adding extended functions
     */
    handleColumns = (queries: ColumnProps<RecordType>[], cachedColumns: ColumnProps<RecordType>[]) => {
        const { hideExpandedColumn, scroll, prefixCls, expandCellFixed, expandIcon, rowSelection } = this.props;
        const childrenColumnName = 'children';
        let columns: ColumnProps<RecordType>[] = cloneDeep(cachedColumns);

        const addFns = (columns: ColumnProps<RecordType>[] = []) => {
            if (Array.isArray(columns) && columns.length) {
                each(columns, (column, index, originColumns) => {
                    const newColumn = this.addFnsInColumn(column);
                    const children = column[childrenColumnName];
                    if (Array.isArray(children) && children.length) {
                        const newChildren = [...children];
                        addFns(newChildren);
                        newColumn[childrenColumnName] = newChildren;
                    }
                    originColumns[index] = newColumn;
                });
            }
        };

        addFns(columns);

        // hideExpandedColumn=false render expand column separately
        if (!hideExpandedColumn) {
            const column = this.normalizeExpandColumn({ prefixCls, expandCellFixed, expandIcon });

            const destIndex = findIndex(columns, item => item.key === strings.DEFAULT_KEY_COLUMN_EXPAND);
            if (column) {
                if (destIndex > -1) {
                    columns[destIndex] = { ...column, ...columns[destIndex] };
                } else if (column.fixed === 'right') {
                    columns = [...columns, column];
                } else {
                    columns = [column, ...columns];
                }
            }
        }

        // selection column
        if (rowSelection && !get(rowSelection, 'hidden')) {
            const destIndex = findIndex(columns, item => item.key === strings.DEFAULT_KEY_COLUMN_SELECTION);
            const column = this.normalizeSelectionColumn({ rowSelection, prefixCls });

            if (destIndex > -1) {
                columns[destIndex] = { ...column, ...columns[destIndex] };
            } else if (column.fixed === 'right') {
                columns = [...columns, column];
            } else {
                columns = [column, ...columns];
            }
        }

        assignColumnKeys(columns);

        return columns;
    };

    /**
     * Convert children to columns object
     * @param {Array} columns
     * @param {ReactNode} children
     * @returns {Array}
     */
    normalizeColumns = (columns: ColumnProps<RecordType>[], children: ReactNode) => {
        const normalColumns = cloneDeep(this.getColumns(columns, children));
        return normalColumns;
    };

    /**
     * Combine pagination and table paging processing functions
     */
    mergePagination = (pagination: TablePaginationProps) => {
        const newPagination = { onChange: this.foundation.setPage, ...pagination };
        return newPagination;
    };

    render() {
        let {
            scroll,
            prefixCls,
            className,
            style: wrapStyle = {},
            bordered,
            id,
            pagination: propPagination,
            virtualized,
            size,
            renderPagination: propRenderPagination,
            getVirtualizedListRef,
            loading,
            hideExpandedColumn,
            rowSelection: propRowSelection,
            ...rest
        } = this.props;

        let {
            rowSelection,
            expandedRowKeys,
            headWidths,
            tableWidth,
            pagination,
            dataSource,
            queries,
            cachedColumns,
            bodyHasScrollBar,
        } = this.state;

        wrapStyle = { ...wrapStyle };

        let columns: ColumnProps<RecordType>[];
        /**
          * As state.queries will change, the columns should be refreshed as a whole at this time
          * The scene of changes in queries
          * 1. Filter
          * 2. Pagination
          *
          * useFullRender needs to be passed to the user selection ReactNode, so columns need to be recalculated every time the selectedRowKeys changes
          * TODO: In the future, the selection passed to the user can be changed to the function type, allowing the user to execute the function to obtain the real-time status of the selection title
          *
          * 由于state.queries会发生变化，此时columns应该整体刷新
          * queries变化的场景
          *  1. 筛选
          *  2. 分页
          * useFullRender需要传给用户selection ReactNode，因此需要每次selectedRowKeys变化时重新计算columns
          * TODO: 未来可以将传给用户的selection改为函数类型，让用户执行函数获取selection title的实时状态
          */
        if (!this.adapter.isAnyColumnUseFullRender(queries)) {
            const rowSelectionUpdate: boolean = propRowSelection && !get(propRowSelection, 'hidden');
            columns = this.foundation.memoizedWithFnsColumns(
                queries,
                cachedColumns,
                rowSelectionUpdate,
                hideExpandedColumn,
                // Update the columns after the body scrollbar changes to ensure that the head and body are aligned
                bodyHasScrollBar
            );
        } else {
            columns = this.handleColumns(queries, cachedColumns);
        }
        const filteredColumns: ColumnProps<RecordType>[] = this.foundation.memoizedFilterColumns(columns);
        const flattenFnsColumns: ColumnProps<RecordType>[] = this.foundation.memoizedFlattenFnsColumns(columns);

        const anyColumnFixed = this.adapter.isAnyColumnFixed(columns);


        /**
         * - If it is the first page break, you need to calculate the current page
         * - If it is manual paging, call foundation to modify the state
         *
         * TODO: After merging issue 1007, you can place it in the constructor to complete
         * The reason is that #1007 exposes the parameters required by getCurrentPageData in the constructor
         */
        // if (isNull(dataSource)) {
        //     const pageData: BasePageData<RecordType> = this.foundation.getCurrentPageData(this.props.dataSource);
        //     dataSource = pageData.dataSource;
        //     pagination = pageData.pagination;
        // }

        const props = {
            ...rest,
            ...this.state,
            // props not in rest
            virtualized,
            scroll,
            prefixCls,
            size,
            hideExpandedColumn,
            // renamed state
            columns,
            // calculated value
            anyColumnFixed,
            rowExpandable: this.mergedRowExpandable,
            pagination,
            dataSource,
            rowSelection,
            expandedRowKeys,
            renderExpandIcon: this.renderExpandIcon,
            filteredColumns,
        };

        const x = get(scroll, 'x');
        const y = get(scroll, 'y');

        if (virtualized) {
            if (typeof wrapStyle.width !== 'number') {
                wrapStyle.width = x;
            }
        }

        const wrapCls = classnames({
            [`${prefixCls}-${strings.SIZE_SMALL}`]: size === strings.SIZE_SMALL,
            [`${prefixCls}-${strings.SIZE_MIDDLE}`]: size === strings.SIZE_MIDDLE,
            [`${prefixCls}-virtualized`]: Boolean(virtualized),
            [`${prefixCls}-bordered`]: bordered,
            [`${prefixCls}-fixed-header`]: Boolean(y),
            [`${prefixCls}-scroll-position-left`]: ['both', 'left'].includes(this.position),
            [`${prefixCls}-scroll-position-right`]: ['both', 'right'].includes(this.position),
        });

        // pagination
        const tablePagination = pagination && propPagination ? this.renderPagination(pagination as TablePaginationProps, propRenderPagination) : null;
        const paginationPosition = get(propPagination, 'position', 'bottom');

        const tableContextValue: TableContextProps = {
            ...this.context,
            headWidths,
            tableWidth,
            anyColumnFixed,
            flattenedColumns: flattenFnsColumns,
            renderExpandIcon: this.renderExpandIcon,
            renderSelection: this.renderSelection,
            setHeadWidths: this.setHeadWidths,
            getHeadWidths: this.getHeadWidths,
            getCellWidths: this.getCellWidths,
            handleRowExpanded: this.handleRowExpanded,
            getVirtualizedListRef,
            setBodyHasScrollbar: this.setBodyHasScrollbar,
        };

        const dataAttr = this.getDataAttr(rest);

        return (
            <div
                ref={this.rootWrapRef}
                className={classnames(className, `${prefixCls}-wrapper`, `${prefixCls}-wrapper-${props.direction}`)}
                data-column-fixed={anyColumnFixed}
                style={wrapStyle}
                id={id}
                {...dataAttr}
            >
                <TableContextProvider {...tableContextValue} direction={props.direction}>
                    <Spin spinning={loading} size="large">
                        <div ref={this.wrapRef} className={wrapCls}>
                            <React.Fragment key={'pagination-top'}>
                                {['top', 'both'].includes(paginationPosition) ? tablePagination : null}
                            </React.Fragment>
                            {this.renderTitle({
                                title: (props as any).title,
                                dataSource: props.dataSource,
                                prefixCls: props.prefixCls,
                            })}
                            <div className={`${prefixCls}-container`}>{this.renderMainTable({ ...props })}</div>
                            <React.Fragment key={'pagination-bottom'}>
                                {['bottom', 'both'].includes(paginationPosition) ? tablePagination : null}
                            </React.Fragment>
                        </div>
                    </Spin>
                </TableContextProvider>
            </div>
        );
    }
}

export default Table;
