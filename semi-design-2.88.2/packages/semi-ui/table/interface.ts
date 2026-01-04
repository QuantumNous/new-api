import React, { ReactNode, MutableRefObject } from 'react';

import type { BaseProps } from '../_base/baseComponent';
import type { PaginationProps } from '../pagination';
import type { CheckboxProps } from '../checkbox';
import type { Locale } from '../locale/interface';
import type { ArrayElement } from '../_base/base';
import { strings } from '@douyinfe/semi-foundation/table/constants';
import type {
    BaseRowKeyType,
    BaseSortOrder,
    BaseGroupBy,
    BaseGroupByFn,
    BaseFixed,
    BaseAlign,
    BaseChangeInfoSorter,
    BaseSorter,
    BaseFilter,
    BaseChangeInfoFilter,
    BaseIncludeGroupRecord,
    BaseEllipsis,
    OnChangeExtra
} from '@douyinfe/semi-foundation/table/foundation';
import type { ColumnFilterProps } from './ColumnFilter';
import { TableCellProps } from './TableCell';

export interface TableProps<RecordType extends Record<string, any> = any> extends BaseProps {
    bordered?: boolean;
    children?: ReactNode;
    childrenRecordName?: string;
    className?: string;
    clickGroupedRowToExpand?: boolean;
    columns?: ColumnProps<RecordType>[];
    components?: TableComponents;
    dataSource?: RecordType[];
    defaultExpandAllGroupRows?: boolean;
    defaultExpandAllRows?: boolean;
    defaultExpandedRowKeys?: (string | number)[];
    empty?: ReactNode;
    expandAllGroupRows?: boolean;
    expandAllRows?: boolean;
    expandCellFixed?: Fixed;
    expandIcon?: ExpandIcon;
    expandedRowKeys?: (string | number)[];
    expandedRowRender?: ExpandedRowRender<RecordType>;
    expandRowByClick?: boolean;
    footer?: Footer<RecordType>;
    getVirtualizedListRef?: GetVirtualizedListRef;
    groupBy?: GroupBy<RecordType>;
    hideExpandedColumn?: boolean;
    id?: string;
    indentSize?: number;
    keepDOM?: boolean;
    loading?: boolean;
    pagination?: TablePagination;
    prefixCls?: string;
    renderGroupSection?: RenderGroupSection;
    renderPagination?: RenderPagination;
    resizable?: Resizable<RecordType>;
    rowExpandable?: RowExpandable<RecordType>;
    rowKey?: RowKey<RecordType>;
    rowSelection?: RowSelection<RecordType>;
    scroll?: Scroll;
    showHeader?: boolean;
    size?: Size;
    style?: React.CSSProperties;
    title?: Title<RecordType>;
    virtualized?: Virtualized;
    onChange?: OnChange<RecordType>;
    onExpand?: OnExpand<RecordType>;
    onExpandedRowsChange?: OnExpandedRowsChange<RecordType>;
    onGroupedRow?: OnGroupedRow<RecordType>;
    onHeaderRow?: OnHeaderRow<RecordType>;
    onRow?: OnRow<RecordType>;
    sticky?: Sticky;
    direction?: Direction
}

export interface ColumnProps<RecordType extends Record<string, any> = any> {
    [x: string]: any;
    align?: Align;
    children?: Array<ColumnProps<RecordType>>;
    className?: string;
    colSpan?: number;
    /** use `dataIndex` to get current column data item from record. If you use `sorter` or `onFilter`, a unique `dataIndex` is required  */
    dataIndex?: string;
    defaultFilteredValue?: any[];
    defaultSortOrder?: SortOrder;
    filterChildrenRecord?: boolean;
    filterDropdown?: ColumnFilterProps['filterDropdown'];
    /** render filter Dropdown panel content  */
    renderFilterDropdown?: ColumnFilterProps['renderFilterDropdown'];
    /** filter Dropdown props  */
    filterDropdownProps?: ColumnFilterProps['filterDropdownProps'];
    filterDropdownVisible?: boolean;
    filterIcon?: FilterIcon;
    filterMultiple?: boolean;
    filteredValue?: any[];
    /** `filters` is not required if you use `renderFilterDropdown`  */
    filters?: Filter[];
    fixed?: Fixed;
    /** the key required by React. If you have already set the `dataIndex`, the key does not need to be set again.  */
    key?: string | number;
    render?: ColumnRender<RecordType>;
    renderFilterDropdownItem?: RenderFilterDropdownItem;
    sortChildrenRecord?: boolean;
    sortOrder?: SortOrder;
    /** enable sorting, `dataIndex` is required at the same time  */
    sorter?: Sorter<RecordType>;
    sortIcon?: SortIcon;
    title?: ColumnTitle;
    useFullRender?: boolean;
    width?: string | number;
    onCell?: OnCell<RecordType>;
    /** enable filtering, `dataIndex` is required at the same time  */
    onFilter?: OnFilter<RecordType>;
    onFilterDropdownVisibleChange?: OnFilterDropdownVisibleChange;
    onHeaderCell?: OnHeaderCell<RecordType>;
    ellipsis?: BaseEllipsis;
    resize?: boolean;
    showSortTip?: boolean;
    /**
     * self control whether to update cell for performance reasons
     */
    shouldCellUpdate?: (props: TableCellProps, prevProps: TableCellProps) => boolean
}

export type Align = BaseAlign;
export type SortOrder = BaseSortOrder;
export type SortIcon = (props: { sortOrder: SortOrder }) => ReactNode;
export type FilterIcon = boolean | React.ReactNode | FilterIconRenderFunction;
export interface Filter extends BaseFilter {
    value?: any;
    text?: React.ReactNode;
    children?: Filter[]
}
export type Fixed = BaseFixed;
export type OnCell<RecordType> = (record?: RecordType, rowIndex?: number) => OnCellReturnObject;
export type OnFilter<RecordType> = (filteredValue?: any, record?: RecordType) => boolean;
export type OnFilterDropdownVisibleChange = (visible?: boolean) => void;
export type OnHeaderCell<RecordType> = (record?: RecordType, columnIndex?: number, index?: number) => OnHeaderCellReturnObject;
export type ColumnRender<RecordType> = (text: any, record: RecordType, index: number, options?: RenderOptions) => ColumnRenderReturnType;
export type RenderFilterDropdownItem = (itemInfo?: FilterDropdownItem) => ReactNode;
export type Sorter<RecordType> = BaseSorter<RecordType>;
export type ColumnTitle = React.ReactNode | ((ColumnTitleProps?: ColumnTitleProps) => React.ReactNode);
export type FilterIconRenderFunction = (filtered: boolean) => React.ReactNode;
export type ColumnTitleProps = {
    sorter?: React.ReactNode;
    filter?: React.ReactNode;
    selection?: React.ReactNode
};
export type ColumnRenderReturnType = React.ReactNode | RenderReturnObject;
export interface RenderReturnObject {
    [x: string]: any;
    children: React.ReactNode;
    props: {
        [x: string]: any;
        colSpan?: number;
        rowSpan?: number
    }
}
export interface FilterDropdownItem {
    [x: string]: any;
    value?: any;
    text?: React.ReactNode;
    onChange?: React.MouseEventHandler<HTMLLIElement>;
    level?: number;
    filterMultiple?: boolean;
    checked?: boolean
}
export interface RenderOptions {
    expandIcon?: React.ReactNode;
    selection?: React.ReactNode;
    indentText?: React.ReactNode
}
export interface OnCellReturnObject extends React.TdHTMLAttributes<HTMLElement> {
    [x: string]: any;
    style?: React.CSSProperties;
    className?: string;
    onClick?: (e: React.MouseEvent) => void
}
export interface OnHeaderCellReturnObject extends React.ThHTMLAttributes<HTMLElement> {
    [x: string]: any;
    style?: React.CSSProperties;
    className?: string;
    onClick?: (e: React.MouseEvent) => void
}

interface OnRowReturnOmit {
    ref?: React.RefObject<any>
}

export interface OnRowReturnObject extends Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLTableRowElement>, HTMLTableRowElement>, keyof OnRowReturnOmit> {
    [x: string]: any;
    className?: string;
    style?: React.CSSProperties;
    onClick?: (e: React.MouseEvent) => void
}
export interface OnGroupedRowReturnObject extends React.HTMLAttributes<HTMLTableRowElement> {
    [x: string]: any;
    style?: React.CSSProperties;
    onClick?: (e: React.MouseEvent) => void
}
export type OnHeaderRowReturnObject = Omit<React.HTMLAttributes<HTMLTableRowElement>, 'ref' | 'style'>;

export interface Scroll {
    x?: number | string;
    y?: number | string;
    scrollToFirstRowOnChange?: boolean
}

export interface Data {
    [x: string]: any;
    key?: string | number
}

export type TableComponent<P> = React.ComponentType<P> | React.ForwardRefExoticComponent<P> | keyof React.ReactHTML;

export interface TableComponents {
    table?: TableComponent<any>;
    header?: {
        outer?: TableComponent<any>;
        wrapper?: TableComponent<any>;
        row?: TableComponent<any>;
        cell?: TableComponent<any>
    };
    body?: {
        outer?: TableComponent<any>;
        wrapper?: TableComponent<any>;
        row?: TableComponent<any>;
        cell?: TableComponent<any>;
        colgroup?: {
            wrapper?: TableComponent<any>;
            col?: TableComponent<any>
        }
    };
    footer?: {
        wrapper?: TableComponent<any>;
        row?: TableComponent<any>;
        cell?: TableComponent<any>;
        outer?: TableComponent<any>
    }
}

export interface RowSelectionProps<RecordType> {
    className?: string;
    disabled?: boolean;
    fixed?: Fixed;
    getCheckboxProps?: GetCheckboxProps<RecordType>;
    hidden?: boolean;
    selectedRowKeys?: (string | number)[];
    title?: ReactNode;
    width?: string | number;
    onChange?: RowSelectionOnChange<RecordType>;
    onSelect?: RowSelectionOnSelect<RecordType>;
    onSelectAll?: RowSelectionOnSelectAll<RecordType>;
    onCell?: ColumnProps['onCell'];
    onHeaderCell?: ColumnProps['onHeaderCell'];
    renderCell?: RowSelectionRenderCell<RecordType>;
    /**
     * self control whether to update cell for performance reasons
     */
    shouldCellUpdate?: (props: TableCellProps, prevProps: TableCellProps) => boolean
}

export type RowSelectionRenderCell<RecordType> = (renderCellArgs: {
    selected: boolean;
    record: RecordType;
    originNode: JSX.Element;
    inHeader: boolean;
    disabled: boolean;
    indeterminate: boolean;
    index?: number;
    selectRow?: (selected: boolean, e: Event) => void;
    selectAll?: (selected: boolean, e: Event) => void
}) => ReactNode;
export type GetCheckboxProps<RecordType> = (record: RecordType) => Omit<CheckboxProps, 'defaultChecked' | 'checked' | 'indeterminate' | 'onChange'>;
export type RowSelectionOnChange<RecordType> = (selectedRowKeys?: (string | number)[], selectedRows?: RecordType[]) => void;
export type RowSelectionOnSelect<RecordType> = (
    record?: RecordType,
    selected?: boolean,
    selectedRows?: RecordType[],
    nativeEvent?: React.MouseEvent
) => void;
export type RowSelectionOnSelectAll<RecordType> = (selected?: boolean, selectedRows?: RecordType[], changedRows?: RecordType[]) => void;
export type ExpandIcon = ((expanded?: boolean) => React.ReactNode) | React.ReactNode;
export type ExpandedRowRender<RecordType> = (record?: RecordType, index?: number, expanded?: boolean) => React.ReactNode;
export type Footer<RecordType> = ReactNode | ((pageData?: RecordType[]) => React.ReactNode);
export type FormatPageText = ((pageInfo?: { currentStart?: number; currentEnd?: number; total?: number }) => React.ReactNode) | boolean;
/**
 * ref to react-window `VariableSizeList` instance
 * 
 * only work when `virtualized` is truthy
 * 
 * @see https://github.com/DefinitelyTyped/DefinitelyTyped/blob/58aabc0cfd2baf08f5f71a2712ae7baa6cb2a3ce/types/react-window/index.d.ts#L378
 */
export type GetVirtualizedListRef = (ref: MutableRefObject<{
    /**
     * Scroll to the specified offset (scrollTop or scrollLeft, depending on the direction prop).
     */
    scrollTo(scrollOffset: number): void;
    /**
     * Scroll to the specified item.
     *
     * By default, the List will scroll as little as possible to ensure the item is visible.
     * You can control the alignment of the item though by specifying a second alignment parameter. Acceptable values are:
     *
     * - auto (default) - Scroll as little as possible to ensure the item is visible. (If the item is already visible, it won't scroll at all.)
     * - smart
     *   - If the item is already visible, don't scroll at all.
     *   - If it is less than one viewport away, scroll as little as possible so that it becomes visible.
     *   - If it is more than one viewport away, scroll so that it is centered within the list.
     * - center - Center align the item within the list.
     * - end - Align the item to the end of the list (the bottom for vertical lists or the right for horizontal lists).
     * - start - Align the item to the beginning of the list (the top for vertical lists or the left for horizontal lists).
     */
    scrollToItem(index: number, align?: "auto" | "smart" | "center" | "end" | "start"): void
}>) => void;
export type GroupByFunction<RecordType> = BaseGroupByFn<RecordType>;
export type GroupBy<RecordType> = BaseGroupBy<RecordType>;
export type Size = ArrayElement<typeof strings.SIZES>;
export type Title<RecordType> = React.ReactNode | ((pageData?: RecordType[]) => React.ReactNode);
export type PaginationPosition = ArrayElement<typeof strings.PAGINATION_POSITIONS>;
export type Pagination = TablePaginationProps | boolean;
export type TablePagination = Pagination;
export interface ChangeInfoFilter<RecordType> extends BaseChangeInfoFilter<RecordType> {
    filters?: Filter[];
    onFilter?: OnFilter<RecordType>
}
export type ChangeInfoSorter<RecordType> = BaseChangeInfoSorter<RecordType>;
export interface ChangeInfo<RecordType> {
    pagination?: TablePaginationProps;
    filters?: ChangeInfoFilter<RecordType>[];
    sorter?: ChangeInfoSorter<RecordType>;
    extra?: OnChangeExtra
}
export type OnChange<RecordType> = (changeInfo: ChangeInfo<RecordType>) => void;
export type OnRow<RecordType> = (record?: RecordType, index?: number) => OnRowReturnObject;
export type OnGroupedRow<RecordType> = (record?: RecordType, index?: number) => OnGroupedRowReturnObject;
export type OnHeaderRow<RecordType> = (columns?: ColumnProps<RecordType>[], index?: number) => OnHeaderRowReturnObject;
export type OnExpandedRowsChange<RecordType> = (expandedRows?: IncludeGroupRecord<RecordType>[]) => void;
export type OnExpand<RecordType> = (expanded?: boolean, record?: IncludeGroupRecord<RecordType>, mouseEvent?: React.MouseEvent) => void;
export type RenderGroupSection = (groupKey?: string | number, group?: (string | number)[]) => ReactNode | {
    [x: string]: any;
    children: ReactNode
};
export type RenderPagination = (paginationProps: TablePaginationProps) => ReactNode;
export type RowExpandable<RecordType> = (record?: RecordType) => boolean;
export type RowKey<RecordType> = BaseRowKeyType | ((record?: RecordType) => string);
export type RowSelection<RecordType> = RowSelectionProps<RecordType> | boolean;

export type VirtualizedOnScrollArgs = {
    scrollDirection?: "forward" | "backward";
    scrollOffset?: number;
    scrollUpdateWasRequested?: boolean
};

export type VirtualizeItemSizeRow = { 
    sectionRow?: boolean; 
    expandedRow?: boolean
};
export type VirtualizedItemSizeFn = (index?: number, row?: VirtualizeItemSizeRow) => number;
export type VirtualizedItemSize = number | VirtualizedItemSizeFn;
export type VirtualizedOnScroll = (object: VirtualizedOnScrollArgs) => void;
export interface VirtualizedProps {
    [x: string]: any;
    itemSize?: VirtualizedItemSize;
    onScroll?: VirtualizedOnScroll
}
export type Virtualized = boolean | VirtualizedProps;

export interface TablePaginationProps extends BaseProps, PaginationProps {
    position?: PaginationPosition;
    formatPageText?: FormatPageText
}

export type Resizable<RecordType> = ResizableProps<RecordType> | boolean;
export interface ResizableProps<RecordType> {
    onResize?: ResizeFn<RecordType>;
    onResizeStart?: ResizeFn<RecordType>;
    onResizeStop?: ResizeFn<RecordType>
}
export type ResizeFn<RecordType> = (column: RecordType) => RecordType;

export interface BodyScrollEvent extends React.UIEvent {
    [x: string]: any;
    currentTarget: any;
    target: any
}

export type BodyScrollPosition = 'both' | 'middle' | 'left' | 'right';

export type TableLocale = Locale['Table'];
export type Direction = "ltr" | "rtl";
export type IncludeGroupRecord<RecordType> = BaseIncludeGroupRecord<RecordType>;
export type Sticky = boolean | {
    top?: number
}