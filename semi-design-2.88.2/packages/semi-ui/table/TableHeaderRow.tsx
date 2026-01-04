import React from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { get, noop, map, set, omit, findIndex } from 'lodash';

import { cssClasses } from '@douyinfe/semi-foundation/table/constants';
import {
    arrayAdd,
    isFirstFixedRight,
    isLastLeftFixed,
    isFixedLeft,
    isFixedRight,
    sliceColumnsByLevel,
    getRTLAlign
} from '@douyinfe/semi-foundation/table/utils';
import BaseComponent from '../_base/baseComponent';
import TableContext, { TableContextProps } from './table-context';
import { TableComponents, OnHeaderRow, Fixed, TableLocale } from './interface';
import type { TableHeaderCell } from './TableHeader';
import Tooltip from '../tooltip';
import LocaleConsumer from '../locale/localeConsumer';
import { getNextSortOrder } from './utils';

export interface TableHeaderRowProps {
    components?: TableComponents;
    row?: TableHeaderCell[];
    prefixCls?: string;
    onHeaderRow?: OnHeaderRow<any>;
    index?: number;
    style?: React.CSSProperties;
    columns?: any[];
    fixed?: Fixed;
    selectedRowKeysSet: Set<any>
}

export default class TableHeaderRow extends BaseComponent<TableHeaderRowProps, Record<string, any>> {
    static contextType = TableContext;

    static propTypes = {
        components: PropTypes.object,
        row: PropTypes.array,
        prefixCls: PropTypes.string,
        onHeaderRow: PropTypes.func,
        index: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        style: PropTypes.object,
        columns: PropTypes.array,
        fixed: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
        selectedRowKeysSet: PropTypes.instanceOf(Set).isRequired,
    };

    static defaultProps = {
        onHeaderRow: noop,
        prefixCls: cssClasses.PREFIX,
        columns: [] as [],
        components: {
            header: {
                wrapper: 'thead',
                row: 'tr',
                cell: 'th',
            },
        },
    };

    get adapter() {
        return {
            ...super.adapter,
        };
    }

    headerNode: HTMLElement;
    context: TableContextProps;

    constructor(props: TableHeaderRowProps) {
        super(props);
        this.headerNode = null;
    }

    cacheRef = (node: HTMLElement) => {
        this.headerNode = node;
        if (node && this.context.setHeadWidths) {
            const { prefixCls, row, index } = this.props;
            const cellSelector = `.${prefixCls}-row-head`;
            const heads = node && node.querySelectorAll && node.querySelectorAll(cellSelector);

            this.context.setHeadWidths(
                map(heads, (head, headIndex) => {
                    let configWidth = get(row, [headIndex, 'column', 'width']);
                    const key = get(row, [headIndex, 'column', 'key']) as any;
                    if (typeof configWidth !== 'number') {
                        configWidth = (head && head.getBoundingClientRect().width) || 0;
                    }
                    return { width: configWidth, key };
                }),
                index
            );
        }
    };

    componentDidUpdate(prevProps: TableHeaderRowProps) {
        if (prevProps.columns !== this.props.columns && this.headerNode) {
            this.cacheRef(this.headerNode);
        }
    }

    render() {
        const { components, row, prefixCls, onHeaderRow, index, style, columns } = this.props;
        const { getCellWidths, direction } = this.context;
        const isRTL = direction === 'rtl';
        const slicedColumns = sliceColumnsByLevel(columns, index);
        const headWidths = getCellWidths(slicedColumns);

        const HeaderRow = get(components, 'header.row', 'tr');
        const HeaderCell = get(components, 'header.cell', 'th');

        const rowProps = onHeaderRow(columns, index) || {};
        set(rowProps, 'className', classnames(get(rowProps, 'className'), `${prefixCls}-row`));

        const cells = map(row, (cell, cellIndex) => {
            const { column, ...cellProps } = cell;
            const customProps =
                typeof column.onHeaderCell === 'function' ? column.onHeaderCell(column, cellIndex, index) : {};
            let cellStyle = { ...customProps.style };
            if (column.align) {
                const textAlign = getRTLAlign(column.align, direction);
                cellStyle = { ...cellStyle, textAlign };
                customProps.className = classnames(customProps.className, column.className, {
                    [`${prefixCls}-align-${textAlign}`]: Boolean(textAlign),
                });
            }

            let fixedLeft, fixedRight, fixedLeftLast, fixedRightFirst;
            if (isRTL) {
                fixedLeft = isFixedRight(column);
                fixedRight = isFixedLeft(column);
                fixedLeftLast = isFirstFixedRight(slicedColumns, column);
                fixedRightFirst = isLastLeftFixed(slicedColumns, column);
            } else {
                fixedLeft = isFixedLeft(column);
                fixedRight = isFixedRight(column);
                fixedLeftLast = isLastLeftFixed(slicedColumns, column);
                fixedRightFirst = isFirstFixedRight(slicedColumns, column);
            }

            customProps.className = classnames(
                `${prefixCls}-row-head`,
                column.className,
                customProps.className,
                // `${prefixCls}-fixed-columns`,
                {
                    [`${prefixCls}-cell-fixed-left`]: fixedLeft,
                    [`${prefixCls}-cell-fixed-left-last`]: fixedLeftLast,
                    [`${prefixCls}-cell-fixed-right`]: fixedRight,
                    [`${prefixCls}-cell-fixed-right-first`]: fixedRightFirst,
                    [`${prefixCls}-row-head-ellipsis`]: column.ellipsis,
                    [`${prefixCls}-row-head-clickSort`]: column.clickToSort
                }
            );

            if (headWidths.length && slicedColumns.length) {
                const indexOfSlicedColumns = findIndex(
                    slicedColumns,
                    item => item && item.key != null && item.key === column.key
                );
                if (indexOfSlicedColumns > -1) {
                    if (isFixedLeft(column)) {
                        const xPositionKey = isRTL ? 'right' : 'left';
                        cellStyle = {
                            ...cellStyle,
                            position: 'sticky',
                            [xPositionKey]: arrayAdd(headWidths, 0, indexOfSlicedColumns),
                        };
                    } else if (isFixedRight(column)) {
                        const xPositionKey = isRTL ? 'left' : 'right';
                        cellStyle = {
                            ...cellStyle,
                            position: 'sticky',
                            [xPositionKey]: arrayAdd(headWidths, indexOfSlicedColumns + 1),
                        };
                    }
                }
            }

            Object.assign(cellProps, { resize: column.resize });

            const props = omit({ ...cellProps, ...customProps }, [
                'colStart',
                'colEnd',
                'hasSubColumns',
                'parents',
                'level',
            ]);

            const { rowSpan, colSpan } = props;
            if (rowSpan === 0 || colSpan === 0) {
                return null;
            }
            
            if (typeof column.clickToSort === 'function') {
                if (props.onClick) {
                    const onClick = props.onClick;
                    props.onClick = (e: any) => {
                        onClick(e);
                        column.clickToSort(e);
                    };
                } else {
                    props.onClick = column.clickToSort;
                }
            }

            if (typeof column.mouseDown === 'function') {
                if (props.onMouseDown) {
                    const onMouseDown = props.onMouseDown;
                    props.onMouseDown = (e: any) => {
                        onMouseDown(e);
                        column.mouseDown(e);
                    };
                } else {
                    props.onMouseDown = column.mouseDown;
                }
            }

            const headerCellNode = (<HeaderCell
                role="columnheader"
                aria-colindex={cellIndex + 1}
                {...props}
                style={cellStyle}
                key={column.key || column.dataIndex || cellIndex}
            />);
            if (typeof column.clickToSort === 'function' && column.showSortTip === true) {
                let content = getNextSortOrder(column.sortOrder);
                return (<LocaleConsumer 
                    componentName="Table" 
                    key={column.key || column.dataIndex || cellIndex}
                >
                    {(locale: TableLocale, localeCode: string) => (
                        <Tooltip content={locale[content]}>
                            {headerCellNode}
                        </Tooltip>
                    )}
                </LocaleConsumer>);
            }

            return headerCellNode;
        });

        return (
            // @ts-ignore no need to do complex ts type checking and qualification
            <HeaderRow
                role="row"
                aria-rowindex={index + 1}
                {...rowProps}
                style={style}
                ref={this.cacheRef}
            >
                {cells}
            </HeaderRow>
        );
    }
}
