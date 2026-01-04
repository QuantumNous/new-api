import React, { ReactNode } from 'react';
import PropTypes from 'prop-types';
import { get, size, isMap, each, isEqual, pick, isNull, isFunction } from 'lodash';
import classnames from 'classnames';
import { VariableSizeList as List } from 'react-window';

import {
    arrayAdd,
    getRecordKey,
    isExpanded,
    isSelected,
    isDisabled,
    getRecord,
    genExpandedRowKey,
    getDefaultVirtualizedRowConfig,
    isTreeTable
} from '@douyinfe/semi-foundation/table/utils';
import BodyFoundation, { BodyAdapter, FlattenData, GroupFlattenData } from '@douyinfe/semi-foundation/table/bodyFoundation';
import { strings } from '@douyinfe/semi-foundation/table/constants';
import Store from '@douyinfe/semi-foundation/utils/Store';

import BaseComponent, { BaseProps } from '../../_base/baseComponent';
import { logger } from '../utils';
import ColGroup from '../ColGroup';
import BaseRow, { baseRowPropTypes } from './BaseRow';
import ExpandedRow from './ExpandedRow';
import SectionRow, { sectionRowPropTypes } from './SectionRow';
import TableHeader from '../TableHeader';
import ConfigContext from '../../configProvider/context';
import TableContext, { TableContextProps } from '../table-context';
import type {
    ExpandedRowRender,
    Virtualized,
    VirtualizedItemSize,
    GetVirtualizedListRef,
    ColumnProps,
    Size,
    BodyScrollEvent,
    Scroll,
    Fixed,
    TableComponents,
    RowExpandable,
    VirtualizedOnScroll,
    Direction,
    RowKey
} from '../interface';

export interface BodyProps extends BaseProps {
    tableLayout?: 'fixed' | 'auto';
    anyColumnFixed?: boolean;
    columns?: ColumnProps[];
    dataSource?: Record<string, any>[];
    disabledRowKeysSet: Set<any>; // required
    emptySlot?: ReactNode;
    expandedRowKeys?: (string | number)[];
    expandedRowRender?: ExpandedRowRender<Record<string, any>>;
    fixed?: Fixed;
    forwardedRef?: React.MutableRefObject<HTMLDivElement> | ((instance: any) => void);
    handleBodyScroll?: (e: BodyScrollEvent) => void;
    handleWheel?: (e: React.WheelEvent<HTMLDivElement>) => void;
    includeHeader?: boolean;
    prefixCls?: string;
    scroll?: Scroll;
    selectedRowKeysSet: Set<any>; // required
    showHeader?: boolean;
    size?: Size;
    virtualized?: Virtualized;
    components?: TableComponents;
    store: Store;
    groups?: Map<string, Record<string, any>[]>[];
    rowKey?: RowKey<Record<string, any>>;
    childrenRecordName?: string;
    rowExpandable?: RowExpandable<Record<string, any>>;
    renderExpandIcon: (record: Record<string, any>, isNested: boolean) => ReactNode | null;
    headerRef?: React.MutableRefObject<HTMLDivElement> | ((instance: any) => void);
    onScroll?: VirtualizedOnScroll;
    keepDOM?: boolean
}

export interface BodyState {
    virtualizedData?: Array<FlattenData | GroupFlattenData>;
    cache?: {
        virtualizedScrollTop?: number;
        virtualizedScrollLeft?: number
    };
    cachedExpandBtnShouldInRow?: boolean;
    cachedExpandRelatedProps?: any[]
}

export interface BodyContext {
    getVirtualizedListRef: GetVirtualizedListRef;
    flattenedColumns: ColumnProps[];
    getCellWidths: (flattenedColumns: ColumnProps[]) => number[]
}

class Body extends BaseComponent<BodyProps, BodyState> {
    static contextType = TableContext;
    static propTypes = {
        anyColumnFixed: PropTypes.bool,
        childrenRecordName: PropTypes.string,
        columns: PropTypes.array,
        components: PropTypes.object,
        dataSource: PropTypes.array,
        disabledRowKeysSet: PropTypes.instanceOf(Set).isRequired,
        emptySlot: PropTypes.node,
        expandRowByClick: PropTypes.bool,
        expandedRowKeys: PropTypes.array,
        expandedRowRender: PropTypes.func,
        fixed: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
        forwardedRef: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
        groups: PropTypes.instanceOf(Map),
        handleBodyScroll: PropTypes.func,
        handleWheel: PropTypes.func,
        headerRef: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
        includeHeader: PropTypes.bool,
        onScroll: PropTypes.func,
        prefixCls: PropTypes.string,
        renderExpandIcon: PropTypes.func,
        rowExpandable: PropTypes.func,
        rowKey: PropTypes.oneOfType([PropTypes.string, PropTypes.bool, PropTypes.func]),
        scroll: PropTypes.object,
        selectedRowKeysSet: PropTypes.instanceOf(Set).isRequired,
        showHeader: PropTypes.bool,
        size: PropTypes.string,
        store: PropTypes.object,
        virtualized: PropTypes.oneOfType([PropTypes.bool, PropTypes.object]),
    };

    ref: React.MutableRefObject<any>;
    listRef: React.MutableRefObject<any>;
    observer: ResizeObserver;
    foundation: BodyFoundation;
    cellWidths: number[];
    flattenedColumns: ColumnProps[];
    context: TableContextProps;
    constructor(props: BodyProps, context: BodyContext) {
        super(props);
        this.ref = React.createRef();
        this.state = {
            virtualizedData: [],
            cache: {
                virtualizedScrollTop: null,
                virtualizedScrollLeft: null,
            },
            cachedExpandBtnShouldInRow: null,
            cachedExpandRelatedProps: [],
        };

        this.listRef = React.createRef();
        const { flattenedColumns, getCellWidths } = context;
        this.foundation = new BodyFoundation(this.adapter);
        this.flattenedColumns = flattenedColumns;
        this.cellWidths = getCellWidths(flattenedColumns);
        this.observer = null;
    }

    get adapter(): BodyAdapter<BodyProps, BodyState> {
        return {
            ...super.adapter,
            setVirtualizedData: (virtualizedData, cb) => this.setState({ virtualizedData }, cb),
            setCachedExpandBtnShouldInRow: cachedExpandBtnShouldInRow => this.setState({ cachedExpandBtnShouldInRow }),
            setCachedExpandRelatedProps: cachedExpandRelatedProps => this.setState({ cachedExpandRelatedProps }),
            observeBodyResize: (bodyWrapDOM: HTMLDivElement) => {
                const { setBodyHasScrollbar } = this.context;

                // Callback when the size of the body dom content changes, notifying Table.jsx whether the bodyHasScrollBar exists
                const resizeCallback = () => {
                    const update = () => {
                        const { offsetWidth, clientWidth } = bodyWrapDOM;
                        const bodyHasScrollBar = clientWidth < offsetWidth;
                        setBodyHasScrollbar(bodyHasScrollBar);
                    };
                    const requestAnimationFrame = window.requestAnimationFrame || window.setTimeout;
                    requestAnimationFrame(update);
                };

                // Monitor body dom resize
                if (bodyWrapDOM) {
                    if (get(window, 'ResizeObserver')) {
                        if (this.observer) {
                            this.observer.unobserve(bodyWrapDOM);
                            this.observer = null;
                        }
                        this.observer = new ResizeObserver(resizeCallback);
                        this.observer.observe(bodyWrapDOM);
                    } else {
                        logger.warn(
                            'The current browser does not support ResizeObserver,' +
                            'and the table may be misaligned after plugging and unplugging the mouse and keyboard.' +
                            'You can try to refresh it.'
                        );
                    }
                }
            },
            unobserveBodyResize: () => {
                const bodyWrapDOM = this.ref.current;
                if (this.observer) {
                    this.observer.unobserve(bodyWrapDOM);
                    this.observer = null;
                }
            },
        };
    }

    componentDidUpdate(prevProps: BodyProps, prevState: BodyState) {
        const { virtualized, dataSource, expandedRowKeys, columns, scroll } = this.props;
        if (virtualized) {
            if (
                prevProps.dataSource !== dataSource ||
                prevProps.expandedRowKeys !== expandedRowKeys ||
                prevProps.columns !== columns
            ) {
                this.foundation.initVirtualizedData();
            }
        }

        const expandRelatedProps = strings.EXPAND_RELATED_PROPS;
        const newExpandRelatedProps = expandRelatedProps.map(key => get(this.props, key, undefined));
        if (!isEqual(newExpandRelatedProps, prevState.cachedExpandRelatedProps)) {
            this.foundation.initExpandBtnShouldInRow(newExpandRelatedProps);
        }

        const scrollY = get(scroll, 'y');
        const bodyWrapDOM = this.ref.current;
        if (scrollY && scrollY !== get(prevProps, 'scroll.y')) {
            this.foundation.observeBodyResize(bodyWrapDOM);
        }
    }

    forwardRef = (node: HTMLDivElement) => {
        const { forwardedRef } = this.props;
        this.ref.current = node;
        this.foundation.observeBodyResize(node);
        if (typeof forwardedRef === 'function') {
            forwardedRef(node);
        } else if (forwardedRef && typeof forwardedRef === 'object') {
            forwardedRef.current = node;
        }
    };

    setListRef = (listInstance: List) => {
        this.listRef.current = listInstance;
        const { getVirtualizedListRef } = this.context;
        if (getVirtualizedListRef) {
            if (this.props.virtualized) {
                getVirtualizedListRef(this.listRef);
            } else {
                console.warn('getVirtualizedListRef only works with virtualized. ' +
                    'See https://semi.design/en-US/show/table for more information.');
            }
        }
    };

    itemSize = (index: number) => {
        const { virtualized, size: tableSize } = this.props;
        const { virtualizedData } = this.state;
        const virtualizedItem = get(virtualizedData, index);
        const defaultConfig = getDefaultVirtualizedRowConfig(tableSize, virtualizedItem.sectionRow);

        const itemSize = get(virtualized, 'itemSize', defaultConfig.height) as VirtualizedItemSize;

        let realSize = itemSize as number;

        if (typeof itemSize === 'function') {
            realSize = itemSize(index, {
                expandedRow: get(virtualizedItem, 'expandedRow', false),
                sectionRow: get(virtualizedItem, 'sectionRow', false),
            });
        }

        if (realSize < defaultConfig.minHeight) {
            logger.warn(`The computed real \`itemSize\` cannot be less than ${defaultConfig.minHeight}`);
        }

        return realSize;
    };

    itemKey = (index: number, data: Array<FlattenData | GroupFlattenData>) => get(data, [index, 'key'], index);

    handleRowClick = (rowKey: RowKey<any>, e: React.MouseEvent<HTMLElement>, expand: boolean) => {
        const { handleRowExpanded } = this.context;
        handleRowExpanded(!expand, rowKey, e);
    };

    handleVirtualizedScroll = (props = {}) => {
        const onScroll: undefined | ((props?: any) => void) = get(this.props.virtualized, 'onScroll');
        if (typeof onScroll === 'function') {
            onScroll(props);
        }
    };

    /**
     * @param {MouseEvent<HTMLDivElement>} e
     */
    handleVirtualizedBodyScroll = (e: BodyScrollEvent) => {
        const { handleBodyScroll } = this.props;

        const newScrollLeft = get(e, 'nativeEvent.target.scrollLeft');
        const newScrollTop = get(e, 'nativeEvent.target.scrollTop');

        if (newScrollTop === this.state.cache.virtualizedScrollTop) {
            this.handleVirtualizedScroll({ horizontalScrolling: true });
        }

        this.state.cache.virtualizedScrollLeft = newScrollLeft;
        this.state.cache.virtualizedScrollTop = newScrollTop;

        if (typeof handleBodyScroll === 'function') {
            handleBodyScroll(e);
        }
    };

    getVirtualizedRowWidth = () => {
        const { getCellWidths } = this.context;
        const { columns } = this.props;
        const cellWidths = getCellWidths(columns);
        const rowWidth = arrayAdd(cellWidths, 0, size(columns));

        return rowWidth;
    };

    renderVirtualizedRow = (options: { index?: number; style?: React.CSSProperties; isScrolling?: boolean }) => {
        const { index, style } = options;
        const { virtualizedData, cachedExpandBtnShouldInRow } = this.state;
        const { flattenedColumns } = this.context;
        const virtualizedItem: any = get(virtualizedData, [index], {});
        const { key, parentKeys, expandedRow, sectionRow, ...rest } = virtualizedItem;
        const rowWidth = this.getVirtualizedRowWidth();

        const expandBtnShouldInRow = cachedExpandBtnShouldInRow;

        const props = {
            ...this.props,
            style: {
                ...style,
                width: rowWidth,
            },
            ...rest,
            columns: flattenedColumns,
            index,
            expandBtnShouldInRow,
        };
        return sectionRow ?
            this.renderSectionRow(props) :
            expandedRow ?
                this.renderExpandedRow(props) :
                this.renderBaseRow(props);
    };

    // virtualized List innerElementType
    renderTbody = React.forwardRef<HTMLDivElement, any>((props: any = {}, ref: React.MutableRefObject<HTMLDivElement> | ((instance: HTMLDivElement) => void)) => (
        <div
            {...props}
            onScroll={(...args) => {
                if (props.onScroll) {
                    props.onScroll(...args);
                }
            }}
            // eslint-disable-next-line react/no-this-in-sfc,react/destructuring-assignment
            className={classnames(props.className, `${this.props.prefixCls}-tbody`)}
            style={{ ...props.style }}
            ref={ref}
        />
    ));

    // virtualized List outerElementType
    renderOuter = React.forwardRef<HTMLDivElement, any>((props: any, ref: React.MutableRefObject<HTMLDivElement> | ((instance: HTMLDivElement) => void)) => {
        const { children, ...rest } = props;
        const { handleWheel, prefixCls, emptySlot, dataSource } = this.props;

        const tableWidth = this.getVirtualizedRowWidth();
        const tableCls = classnames(`${prefixCls}`, `${prefixCls}-fixed`);

        return (
            <div
                {...rest}
                ref={ref}
                onWheel={(...args) => {
                    if (handleWheel) {
                        handleWheel(...args);
                    }
                    if (rest.onWheel) {
                        rest.onWheel(...args);
                    }
                }}
                onScroll={(...args) => {
                    this.handleVirtualizedBodyScroll(...args);
                    if (rest.onScroll) {
                        rest.onScroll(...args);
                    }
                }}
            >
                <div style={{ width: tableWidth }} className={tableCls}>
                    {children}
                </div>
                {size(dataSource) === 0 && emptySlot}
            </div>
        );
    });

    onItemsRendered = (props: { overscanStartIndex: number; overscanStopIndex: number; visibleStartIndex: number; visibleStopIndex: number }) => {
        if (this.state.cache.virtualizedScrollLeft && this.ref.current) {
            this.ref.current.scrollLeft = this.state.cache.virtualizedScrollLeft;
        }
    };

    renderVirtualizedBody = (direction?: Direction) => {
        const { scroll, prefixCls, virtualized, columns } = this.props;
        const { virtualizedData } = this.state;
        const { getCellWidths } = this.context;
        const cellWidths = getCellWidths(columns);

        if (!size(cellWidths)) {
            return null;
        }

        const rawY = get(scroll, 'y');
        const yIsNumber = typeof rawY === 'number';
        const y = yIsNumber ? rawY : 600;

        if (!yIsNumber) {
            logger.warn('You have to specific "scroll.y" which must be a number for table virtualization!');
        }

        const listStyle = {
            width: '100%',
            height: virtualizedData?.length ? y : null,
            overflowX: 'auto',
            overflowY: 'auto',
        } as const;

        const wrapCls = classnames(`${prefixCls}-body`);

        return (
            <List<Array<FlattenData | GroupFlattenData>>
                {...(typeof virtualized === 'object' ? virtualized : {})}
                initialScrollOffset={this.state.cache.virtualizedScrollTop}
                onScroll={this.handleVirtualizedScroll}
                onItemsRendered={this.onItemsRendered}
                ref={this.setListRef}
                className={wrapCls}
                outerRef={this.forwardRef}
                height={virtualizedData?.length ? y : 0}
                width={listStyle.width}
                itemData={virtualizedData}
                itemSize={this.itemSize}
                itemCount={virtualizedData.length}
                itemKey={this.itemKey}
                innerElementType={this.renderTbody}
                outerElementType={this.renderOuter}
                style={{ ...listStyle, direction }}
                direction={direction}
            >
                {this.renderVirtualizedRow}
            </List>
        );
    };

    /**
     * render group title
     * @param {*} props
     */
    renderSectionRow = (props: RenderSectionRowProps = { groupKey: undefined }) => {
        const { dataSource, rowKey, group, groupKey, index } = props;
        const sectionRowPickKeys = Object.keys(sectionRowPropTypes);
        const sectionRowProps: any = pick(props, sectionRowPickKeys);

        const { handleRowExpanded } = this.context;

        return (
            <SectionRow
                {...sectionRowProps}
                record={{
                    groupKey,
                    records: [...group].map(recordKey => getRecord(dataSource, recordKey, rowKey)),
                }}
                index={index}
                onExpand={handleRowExpanded}
                data={dataSource}
                key={groupKey || index}
            />
        );
    };

    renderExpandedRow = (props: RenderExpandedRowProps = { renderExpandIcon: () => null }) => {
        const {
            style,
            components,
            renderExpandIcon,
            expandedRowRender,
            record,
            columns,
            expanded,
            index,
            rowKey,
            virtualized,
            displayNone
        } = props;
        let key = getRecordKey(record, rowKey);

        if (key == null) {
            key = index;
        }

        const { flattenedColumns, getCellWidths } = this.context;

        // we use memoized cellWidths to avoid re-render expanded row (fix #686)
        if (flattenedColumns !== this.flattenedColumns) {
            this.flattenedColumns = flattenedColumns;
            this.cellWidths = getCellWidths(flattenedColumns);
        }

        return (
            <ExpandedRow
                style={style}
                components={components}
                renderExpandIcon={renderExpandIcon}
                expandedRowRender={expandedRowRender}
                record={record}
                columns={columns}
                expanded={expanded}
                index={index}
                virtualized={virtualized}
                key={genExpandedRowKey(key)}
                cellWidths={this.cellWidths}
                displayNone={displayNone}
            />
        );
    };

    /**
     * render base row
     * @param {*} props
     * @returns
     */
    renderBaseRow(props: any = {}) {
        const {
            rowKey,
            columns,
            expandedRowKeys,
            rowExpandable,
            record,
            index,
            level,
            expandBtnShouldInRow, // effect the display of the indent span
            selectedRowKeysSet,
            disabledRowKeysSet,
            expandRowByClick,
        } = props;

        const baseRowPickKeys = Object.keys(baseRowPropTypes);
        const baseRowProps: Record<string, any> = pick(props, baseRowPickKeys);

        let key = getRecordKey(record, rowKey);

        if (key == null) {
            key = index;
        }

        const expanded = isExpanded(expandedRowKeys, key);
        const expandable = rowExpandable && rowExpandable(record);

        const expandableProps: {
            level?: number;
            expanded?: boolean;
            expandableRow?: boolean;
            onRowClick?: (...args: any[]) => void
        } = {
            level: undefined,
            expanded,
        };

        if (expandable || expandBtnShouldInRow) {
            expandableProps.level = level;
            expandableProps.expandableRow = expandable;
            if (expandRowByClick) {
                expandableProps.onRowClick = this.handleRowClick;
            }
        }

        const selectionProps = {
            selected: isSelected(selectedRowKeysSet, key),
            disabled: isDisabled(disabledRowKeysSet, key),
        };

        const { getCellWidths } = this.context;
        const cellWidths = getCellWidths(columns, null, true);

        return (
            <BaseRow
                {...baseRowProps}
                {...expandableProps}
                {...selectionProps}
                key={key}
                rowKey={key}
                cellWidths={cellWidths}
            />
        );
    }

    /**
     * render grouped rows
     * @returns {ReactNode[]} renderedRows
     */
    renderGroupedRows = () => {
        const { groups, dataSource: data, rowKey, expandedRowKeys, keepDOM } = this.props;
        const { flattenedColumns } = this.context;
        const groupsInData = new Map();
        const renderedRows: ReactNode[] = [];

        if (groups != null && Array.isArray(data) && data.length) {
            data.forEach(record => {
                const recordKey = getRecordKey(record, rowKey);

                groups.forEach((group: Map<string, Record<string, any>[]>, key: number) => {
                    if (group.has(recordKey)) {
                        if (!groupsInData.has(key)) {
                            groupsInData.set(key, new Set([]));
                        }
                        groupsInData.get(key).add(recordKey);
                        return false;
                    }
                    return undefined;
                });
            });
        }

        let index = -1;
        groupsInData.forEach((group, groupKey) => {
            // Calculate the expanded state of the group
            const expanded = isExpanded(expandedRowKeys, groupKey);

            // Render the title of the group
            renderedRows.push(
                this.renderSectionRow({
                    ...this.props,
                    columns: flattenedColumns,
                    index: ++index,
                    group,
                    groupKey,
                    expanded,
                })
            );

            // Render the grouped content when the group is expanded
            if (expanded || keepDOM) {
                const dataInGroup: any[] = [];

                group.forEach((recordKey: string) => {
                    const record = getRecord(data, recordKey, rowKey);

                    if (record != null) {
                        dataInGroup.push(record);
                    }
                });

                /**
                 * Render the contents of the group row
                 */
                renderedRows.push(this.renderBodyRows(dataInGroup, undefined, [], !expanded));
            }
        });

        return renderedRows;
    };

    renderBodyRows(data: Record<string, any>[] = [], level = 0, renderedRows: ReactNode[] = [], displayNone = false) {
        const {
            rowKey,
            expandedRowRender,
            expandedRowKeys,
            childrenRecordName,
            rowExpandable,
            keepDOM
        } = this.props;

        const hasExpandedRowRender = typeof expandedRowRender === 'function';
        const expandBtnShouldInRow = this.state.cachedExpandBtnShouldInRow;
        const { flattenedColumns } = this.context;

        each(data, (record, index) => {
            let key = getRecordKey(record, rowKey);

            if (key == null) {
                key = index;
            }

            const recordChildren = get(record, childrenRecordName);
            const recordHasChildren = Boolean(Array.isArray(recordChildren) && recordChildren.length);

            renderedRows.push(
                this.renderBaseRow({
                    ...this.props,
                    columns: flattenedColumns,
                    expandBtnShouldInRow,
                    displayNone,
                    record,
                    key,
                    level,
                    index,
                })
            );

            // render expand row
            const expanded = isExpanded(expandedRowKeys, key);
            const shouldRenderExpandedRows = expanded || keepDOM;
            if (hasExpandedRowRender && rowExpandable && rowExpandable(record) && shouldRenderExpandedRows) {
                const currentExpandRow = this.renderExpandedRow({
                    ...this.props,
                    columns: flattenedColumns,
                    level,
                    index,
                    record,
                    expanded,
                    displayNone: displayNone || !expanded,
                });
                /**
                  * If expandedRowRender returns falsy, this expanded row will not be rendered
                  * Render an empty div before v1.19.7
                  */
                if (!isNull(currentExpandRow)) {
                    renderedRows.push(currentExpandRow);
                }
            }

            // render tree data
            if (recordHasChildren && shouldRenderExpandedRows) {
                const nestedRows = this.renderBodyRows(recordChildren, level + 1, [], displayNone || !expanded);
                renderedRows.push(...nestedRows);
            }
        });

        return renderedRows;
    }

    renderBody = (direction?: Direction) => {
        const {
            scroll,
            prefixCls,
            columns,
            components,
            fixed,
            handleWheel,
            headerRef,
            handleBodyScroll,
            anyColumnFixed,
            showHeader,
            emptySlot,
            includeHeader,
            dataSource,
            onScroll,
            groups,
            expandedRowRender,
            tableLayout,
        } = this.props;

        const x = get(scroll, 'x');
        const y = get(scroll, 'y');

        const bodyStyle: {
            maxHeight?: string | number;
            overflow?: string;
            WebkitTransform?: string
        } = {};
        const tableStyle: {
            width?: string | number
        } = {};
        const Table = get(components, 'body.outer', 'table');
        const BodyWrapper = get(components, 'body.wrapper') || 'tbody';

        if (y) {
            bodyStyle.maxHeight = y;
        }

        if (x) {
            tableStyle.width = x;
        }

        if (anyColumnFixed && size(dataSource)) {
            // Auto is better than scroll. For example, when there is only scrollY, the scroll axis is not displayed horizontally.
            bodyStyle.overflow = 'auto';
            // Fix weird webkit render bug
            bodyStyle.WebkitTransform = 'translate3d (0, 0, 0)';
        }

        const colgroup = <ColGroup components={get(components, 'body')} columns={columns} prefixCls={prefixCls} />;
        // const tableBody = this.renderBody();
        const wrapCls = `${prefixCls}-body`;

        const baseTable = (
            <div
                key="bodyTable"
                className={wrapCls}
                style={bodyStyle}
                ref={this.forwardRef}
                onWheel={handleWheel}
                onScroll={handleBodyScroll}
            >
                <Table
                    role={isMap(groups) || isFunction(expandedRowRender) || isTreeTable({ dataSource }) ? 'treegrid' : 'grid'}
                    aria-rowcount={dataSource && dataSource.length}
                    aria-colcount={columns && columns.length}
                    style={tableStyle}
                    className={classnames(prefixCls, {
                        [`${prefixCls}-fixed`]: tableLayout === 'fixed',
                    })}
                >
                    {colgroup}
                    {includeHeader && showHeader ? (
                        <TableHeader {...this.props} ref={headerRef} components={components} columns={columns} />
                    ) : null}
                    <BodyWrapper className={`${prefixCls}-tbody`} onScroll={onScroll}>
                        {isMap(groups) ? this.renderGroupedRows() : this.renderBodyRows(dataSource)}
                    </BodyWrapper>
                </Table>
                {emptySlot}
            </div>
        );

        if (fixed && columns.length) {
            return (
                <div key="bodyTable" className={`${prefixCls}-body-outer`}>
                    {baseTable}
                </div>
            );
        }

        return baseTable;
    };

    render() {
        const { virtualized } = this.props;
        const { direction } = this.context;
        return virtualized ? this.renderVirtualizedBody(direction) : this.renderBody(direction);
    }
}

export default React.forwardRef<HTMLDivElement, Omit<BodyProps, 'forwardedRef'>>(function TableBody(props, ref) {
    return <Body {...props} forwardedRef={ref} />;
});

export interface RenderExpandedRowProps {
    style?: React.CSSProperties;
    components?: TableComponents;
    renderExpandIcon: (record?: Record<string, any>, isNested?: boolean) => ReactNode | null;
    expandedRowRender?: ExpandedRowRender<Record<string, any>>;
    record?: Record<string, any>;
    columns?: ColumnProps[];
    expanded?: boolean;
    index?: number;
    rowKey?: RowKey<Record<string, any>>;
    virtualized?: Virtualized;
    level?: number;
    keepDOM?: boolean;
    displayNone?: boolean
}

export interface RenderSectionRowProps {
    dataSource?: Record<string, any>[];
    columns?: ColumnProps[];
    rowKey?: RowKey<Record<string, any>>;
    group?: any;
    groupKey: string | number;
    index?: number;
    expanded?: boolean
}