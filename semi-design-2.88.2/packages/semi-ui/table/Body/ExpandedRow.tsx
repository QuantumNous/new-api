import React, { PureComponent, isValidElement, ReactNode } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { get, set, isNull } from 'lodash';

import { cssClasses, strings } from '@douyinfe/semi-foundation/table/constants';
import { arrayAdd, filterColumns } from '@douyinfe/semi-foundation/table/utils';
import Store from '@douyinfe/semi-foundation/utils/Store';
import TableContext, { TableContextProps } from '../table-context';
import TableRow from './BaseRow';
import { amendTableWidth } from '../utils';
import { ColumnProps, ExpandIcon, TableComponents, Virtualized, Fixed } from '../interface';

export interface TableExpandedRowProps {
    cellWidths: number[]; // required
    className?: string;
    columns?: ColumnProps[];
    components?: TableComponents;
    defaultExpandAllRows?: boolean;
    defaultExpandedRowKeys?: (string | number)[];
    expandIcon?: ExpandIcon;
    expandRowByClick?: boolean;
    expanded?: boolean;
    expandedRowKeys?: (string | number)[];
    expandedRowRender?: (record?: Record<string, any>, index?: number, expanded?: boolean) => ExpandedRowRenderReturnType;
    indentSize?: number;
    index?: number;
    prefixCls?: string;
    record?: Record<string, any>;
    renderExpandIcon?: (record?: Record<string, any>, isNested?: boolean) => ReactNode | null;
    store?: Store;
    style?: React.CSSProperties;
    virtualized?: Virtualized
    displayNone?: boolean;
}

/**
 * Render expanded row
 */
export default class TableExpandedRow extends PureComponent<TableExpandedRowProps> {
    static contextType = TableContext;

    static propTypes = {
        cellWidths: PropTypes.array.isRequired,
        className: PropTypes.string,
        columns: PropTypes.array,
        components: PropTypes.object,
        defaultExpandAllRows: PropTypes.bool,
        defaultExpandedRowKeys: PropTypes.array,
        expandIcon: PropTypes.oneOfType([PropTypes.object, PropTypes.node, PropTypes.func]),
        expandRowByClick: PropTypes.bool,
        expanded: PropTypes.bool,
        expandedRowKeys: PropTypes.array,
        expandedRowRender: PropTypes.func,
        indentSize: PropTypes.number,
        index: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        onExpand: PropTypes.func,
        onExpandedRowsChange: PropTypes.func,
        prefixCls: PropTypes.string,
        record: PropTypes.object,
        renderExpandIcon: PropTypes.func,
        store: PropTypes.object,
        style: PropTypes.object,
        virtualized: PropTypes.oneOfType([PropTypes.bool, PropTypes.object]),
    };
    static defaultProps = {
        record: {},
        prefixCls: cssClasses.PREFIX,
    };

    context: TableContextProps;

    render() {
        const {
            record,
            columns: propColumns = [],
            prefixCls,
            className,
            expanded,
            expandedRowRender,
            renderExpandIcon,
            index,
            store,
            components,
            style,
            virtualized,
            indentSize,
            cellWidths,
            displayNone
        } = this.props;
        const { tableWidth, anyColumnFixed, getCellWidths } = this.context;
        const cell: ExpandedRowRenderReturnType = expandedRowRender(record, index, expanded);
        let children: ReactNode = null;
        const props: { colSpan?: number; style?: Record<string, any> } = {};
        let column = {};
        if (isNull(cell)) {
            return null;
        } else if (isValidElement(cell)) {
            children = cell;
        } else if (cell && Object.prototype.toString.call(cell) === '[object Object]') {
            const { children: cellChildren, fixed, ...restProps } = cell as { children: ReactNode; fixed: Fixed };
            children = cellChildren;
            column = { ...restProps };
        }

        if (get(components, 'body.cell') !== strings.DEFAULT_COMPONENTS.body.cell) {
            if (virtualized) {
                set(props, 'style.height', '100%');
            }
            set(props, 'style.display', 'block');
            set(props, 'style.width', arrayAdd(cellWidths, 0, propColumns.length));
        } else {
            // Remove the row where the scroll bar is located
            props.colSpan = filterColumns(propColumns).length;
        }

        const columns = [
            {
                render: () => ({
                    props,
                    children: (
                        <div
                            className={classnames(`${prefixCls}-expand-inner`)}
                            style={{
                                width: anyColumnFixed ? amendTableWidth(tableWidth) : undefined,
                            }}
                        >
                            {children}
                        </div>
                    ),
                }),
                ...column,
            },
        ];

        const rowCls = classnames(className, `${prefixCls}-row-expand`);
        const baseRowCellWidths = getCellWidths(columns);

        return (
            <TableRow
                style={style}
                components={components}
                className={rowCls}
                expandedRow={true}
                renderExpandIcon={renderExpandIcon}
                rowKey={`${record.key}-expanded-row`}
                columns={columns}
                store={store}
                virtualized={virtualized}
                indentSize={indentSize}
                cellWidths={baseRowCellWidths}
                displayNone={displayNone}
            />
        );
    }
}

export type ExpandedRowRenderReturnType = React.ReactNode | { children: ReactNode; fixed: Fixed } & ColumnProps;
