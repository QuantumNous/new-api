/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useMemo } from 'react';
import { merge, get, find, noop } from 'lodash';

import { addClass, removeClass } from '@douyinfe/semi-foundation/utils/classnames';
import { strings, numbers } from '@douyinfe/semi-foundation/table/constants';
import { assignColumnKeys, findColumn, withResizeWidth } from '@douyinfe/semi-foundation/table/utils';

import Table from './Table';
import { cloneDeep, mergeColumns } from './utils';
import getColumns from './getColumns';
import ResizableHeaderCell from './ResizableHeaderCell';
import type { ResizableProps, TableProps, ColumnProps } from './interface';

const ResizableTable = (props: TableProps = {}, ref: React.MutableRefObject<Table<any>> | ((instance: Table<any>) => void)) => {
    const { components: propComponents, columns: propColumns, resizable, ...restProps } = props;

    const childrenColumnName = 'children';
    const onResize = get(resizable, 'onResize', noop) as ResizableProps<any>['onResize'];
    const onResizeStart = get(resizable, 'onResizeStart', noop) as ResizableProps<any>['onResize'];
    const onResizeStop = get(resizable, 'onResizeStop', noop) as ResizableProps<any>['onResize'];

    /**
     * 此处关于 columns 有三个存储
     *
     * 1. rawColumns 是根据 props.columns 或者 props.children 解析出来的原始 columns
     * 2. newColumns 是 rawColumns 的深拷贝，同时根据 props.expandedRowRender、props.hideExpandedColumn 和 props.rowSelection
     * 这三个参数加入了【选择列】以及【展开列】
     * 3. columns 是当前组件中存储的 state，一般情况下与 newColumns 相等，但是会保存列当前伸缩的宽度
     */

    /**
      * There are three stores for columns here
      *
      * 1. rawColumns are the original columns parsed according to props.columns or props.children
      * 2. newColumns is a deep copy of rawColumns, based on props.expandedRowRender, props.hideExpandedColumn and props.rowSelection
      * These three parameters have been added [Select Column] and [Expand Column]
      * 3. columns is the state stored in the current component, which is generally equal to newColumns, but it will save the current stretched width of the column
      */

    const parsedColumns = Array.isArray(propColumns) && propColumns.length ? propColumns : getColumns(props.children);

    const rawColumns = assignColumnKeys(cloneDeep(parsedColumns), childrenColumnName);

    const newColumns = assignColumnKeys(cloneDeep(parsedColumns), childrenColumnName);

    if (
        typeof props.expandedRowRender === 'function' &&
        !props.hideExpandedColumn &&
        !find(rawColumns, item => item.key === strings.DEFAULT_KEY_COLUMN_EXPAND)
    ) {
        newColumns.unshift({ key: strings.DEFAULT_KEY_COLUMN_EXPAND, width: numbers.DEFAULT_WIDTH_COLUMN_EXPAND });
    }

    if (props.rowSelection && !get(props.rowSelection, 'hidden') && !find(rawColumns, item => item.key === strings.DEFAULT_KEY_COLUMN_SELECTION)) {
        newColumns.unshift({
            width: get(props, 'rowSelection.width', numbers.DEFAULT_WIDTH_COLUMN_SELECTION),
            key: strings.DEFAULT_KEY_COLUMN_SELECTION,
        });
    }

    const [columns, setColumns] = useState(newColumns);

    useEffect(() => {
        // If there is a resize value, the width does not use the default value fix#1072
        const _newColumns = withResizeWidth(columns, newColumns);
        setColumns(mergeColumns(columns, _newColumns));
    }, [propColumns, props.expandedRowRender, props.hideExpandedColumn, props.rowSelection]);

    const components = useMemo(() => merge(
        {
            header: {
                cell: ResizableHeaderCell,
            },
        },
        propComponents
    ), [propComponents]);

    const handlerClassName = get(resizable, 'handlerClassName', 'resizing');

    const handleResize = (column: ColumnProps) => (e: React.MouseEvent, { size }: { size: { width: number } }) => {
        const nextColumns = cloneDeep(columns);
        const curColumn: ColumnProps = findColumn(nextColumns, column, childrenColumnName);
        let nextColumn = {
            ...curColumn,
            width: size.width,
        };

        const customProps = onResize(nextColumn) || {};

        nextColumn = {
            ...nextColumn,
            ...customProps,
        };

        Object.assign(curColumn, nextColumn);
        setColumns(nextColumns);
    };

    const handleResizeStart = (column: ColumnProps<any>) => (e: React.MouseEvent) => {
        const nextColumns = cloneDeep(columns);

        const curColumn: ColumnProps = findColumn(nextColumns, column, childrenColumnName);

        let nextColumn: ColumnProps = {
            ...curColumn,
            className: addClass(curColumn.className, handlerClassName),
        };

        const customProps = onResizeStart(nextColumn) || {};

        nextColumn = {
            ...nextColumn,
            ...customProps,
        };

        Object.assign(curColumn, nextColumn);

        setColumns(nextColumns);
    };

    const handleResizeStop = (column: ColumnProps) => (e: React.MouseEvent) => {
        const nextColumns = cloneDeep(columns);

        const curColumn: ColumnProps = findColumn(nextColumns, column, childrenColumnName);

        let nextColumn = {
            ...curColumn,
            className: removeClass(curColumn.className, handlerClassName),
        };

        const customProps = onResizeStop(nextColumn) || {};

        nextColumn = {
            ...nextColumn,
            ...customProps,
        };

        Object.assign(curColumn, nextColumn);

        setColumns(nextColumns);
    };

    const resizableRender = (col: ColumnProps, index: number, level = 0, originalHeaderCellProps) => ({
        ...col,
        onHeaderCell: (column: ColumnProps) => {
            return {
                ...originalHeaderCellProps,
                width: column.width,
                onResize: handleResize(column),
                onResizeStart: handleResizeStart(column),
                onResizeStop: handleResizeStop(column),
            };
        },
    });

    const assignResizableRender = (columns: ColumnProps[] = [], level = 0) => (Array.isArray(columns) && columns.length ?
        columns.map((col, index) => {
            const originalHeaderCellProps = col.onHeaderCell?.(col, index, level) ?? {};
            Object.assign(col, resizableRender(col, index, level, originalHeaderCellProps));
            const children = col[childrenColumnName];

            if (Array.isArray(children) && children.length) {
                col[childrenColumnName] = assignResizableRender(children, level + 1);
            }

            return col;
        }) :
        []);

    const finalColumns = useMemo(() => assignResizableRender(columns), [columns]);

    return <Table {...restProps} columns={finalColumns} components={components} ref={ref} />;
};

export default React.forwardRef<Table<any>, TableProps>(ResizableTable);
