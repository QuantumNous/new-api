import React from 'react';
import { noop } from 'lodash';
import { ColumnProps, GetVirtualizedListRef, RowKey } from './interface';
import {
    BaseRowKeyType,
    BaseHeadWidth,
} from '@douyinfe/semi-foundation/table/foundation';
import type { ContextValue } from '../configProvider/context';

export interface TableContextProps {
    children?: React.ReactNode;
    anyColumnFixed?: boolean;
    flattenedColumns?: ColumnProps[];
    tableWidth?: number;
    headWidths?: BaseHeadWidth[][];
    setHeadWidths?: (headWidth?: BaseHeadWidth[], index?: number) => void;
    getHeadWidths?: (index?: number) => number[];
    getCellWidths?: (flattenColumns: ColumnProps[], flattenedWidths?: number[], ignoreScrollBarKey?: boolean) => number[];
    handleRowExpanded?: (expanded: boolean, realKey: RowKey<any>, domEvent: React.MouseEvent<HTMLElement>) => void;
    renderExpandIcon?: (record: Record<string, any>, isNested?: boolean, groupKey?: string | number) => React.ReactNode;
    renderSelection?: (record?: Record<string, any>, isHeader?: boolean) => React.ReactNode;
    getVirtualizedListRef?: GetVirtualizedListRef;
    setBodyHasScrollbar?: (bodyHasScrollBar: boolean) => void;
    direction?: ContextValue['direction']
}

const TableContext = React.createContext<TableContextProps>({
    headWidths: [],
    setHeadWidths: noop,
    handleRowExpanded: noop,
});

export default TableContext;
