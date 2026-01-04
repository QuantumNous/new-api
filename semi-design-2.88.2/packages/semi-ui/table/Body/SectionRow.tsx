import React, { PureComponent, isValidElement, ReactNode } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { get, isSet } from 'lodash';

import Store from '@douyinfe/semi-foundation/utils/Store';
import { cssClasses, strings } from '@douyinfe/semi-foundation/table/constants';
import { filterColumns } from '@douyinfe/semi-foundation/table/utils';
import BaseRow from './BaseRow';
import TableContext, { TableContextProps } from '../table-context';
import {
    ColumnProps,
    RenderGroupSection,
    OnGroupedRow,
    TableComponents,
    Virtualized,
    RowKey,
    OnRowReturnObject
} from '../interface';

export interface SectionRowProps {
    record?: Record<string, any>;
    index?: number;
    columns?: ColumnProps[];
    group?: (string | number)[];
    groupKey: string | number;
    data?: Record<string, any>[];
    renderGroupSection?: RenderGroupSection; // render group title
    onGroupedRow?: OnGroupedRow<Record<string, any>>;
    clickGroupedRowToExpand?: boolean;
    components?: TableComponents;
    expanded?: boolean;
    prefixCls?: string;
    onExpand?: (willExpanded: boolean, groupKey: number | string, e: React.MouseEvent) => void;
    virtualized?: Virtualized;
    style?: React.CSSProperties;
    renderExpandIcon?: (record: Record<string, any>, isNested: boolean, groupKey: string | number) => ReactNode | null;
    className?: string;
    store?: Store;
    rowKey?: RowKey<any>
}

/**
 * avoid affected by https://www.npmjs.com/package/babel-plugin-transform-react-remove-prop-types
 */
export const sectionRowPropTypes = {
    record: PropTypes.object,
    index: PropTypes.number,
    columns: PropTypes.array,
    group: PropTypes.object.isRequired,
    groupKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    data: PropTypes.array,
    renderGroupSection: PropTypes.func, // render group title
    onGroupedRow: PropTypes.func,
    clickGroupedRowToExpand: PropTypes.bool,
    components: PropTypes.object,
    expanded: PropTypes.bool,
    prefixCls: PropTypes.string,
    onExpand: PropTypes.func,
    virtualized: PropTypes.oneOfType([PropTypes.bool, PropTypes.object]),
    style: PropTypes.object,
    renderExpandIcon: PropTypes.func, // passing to baseRow
    className: PropTypes.string,
    store: PropTypes.object,
    rowKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.func]),
};

/**
 * Grouping component title row
 */
class SectionRow extends PureComponent<SectionRowProps> {
    static contextType = TableContext;
    static propTypes = sectionRowPropTypes;

    static defaultProps = {
        prefixCls: cssClasses.PREFIX,
        components: {
            body: {
                row: 'tr',
                cell: 'td',
            },
        },
    };

    context: TableContextProps;

    onRow = (...args: any[]): OnRowReturnObject => {
        const { onGroupedRow, clickGroupedRowToExpand, onExpand, groupKey, expanded } = this.props;
        const rowProps: { onClick?: (e: React.MouseEvent) => void } = {};

        if (typeof onGroupedRow === 'function') {
            Object.assign(rowProps, onGroupedRow(...args));
        }

        return {
            ...rowProps,
            onClick: (e: React.MouseEvent) => {
                if (typeof onExpand === 'function' && clickGroupedRowToExpand) {
                    onExpand(!expanded, groupKey, e);
                }

                if (typeof rowProps.onClick === 'function') {
                    rowProps.onClick(e);
                }
            },
        };
    };

    collectGroupedData = () => {
        const { data, group, rowKey } = this.props;

        if (Array.isArray(data) && data.length && isSet(group)) {
            return data.filter(record => {
                const realRowKey = typeof rowKey === 'function' ? rowKey(record) : get(record, rowKey);
                return realRowKey != null && realRowKey !== '' && group.has(realRowKey);
            });
        }

        return [];
    };

    renderExpandIcon = (record: any) => {
        const { renderExpandIcon, groupKey } = this.props;

        if (typeof renderExpandIcon === 'function') {
            return renderExpandIcon(record, false, groupKey);
        }
        return null;
    };

    isInnerColumnKey(key: any) {
        if (key != null) {
            return [strings.DEFAULT_KEY_COLUMN_EXPAND, strings.DEFAULT_KEY_COLUMN_SELECTION].includes(key);
        }

        return false;
    }

    render() {
        const {
            record,
            columns: propColumns = [],
            prefixCls,
            className,
            expanded,
            renderGroupSection,
            components,
            index,
            store,
            group,
            groupKey,
            virtualized,
            style,
        } = this.props;

        const props: { colSpan?: number } = {};
        let column = {};
        let children: ReactNode = null;
        // render title
        const cell = typeof renderGroupSection === 'function' ? renderGroupSection(groupKey, [...group]) : null;

        if (isValidElement(cell)) {
            children = cell;
        } else if (cell && Object.prototype.toString.call(cell) === '[object Object]') {
            const { children: cellChildren, ...restProps } = cell as { children?: ReactNode };
            children = cellChildren;
            column = { ...restProps };
        }

        // Filter out scroll-bar column
        props.colSpan = filterColumns(propColumns).length;

        const columns = [{ render: () => ({ props, children }), ...column }];

        const rowCls = classnames(className, `${prefixCls}-row-section`, {
            on: expanded,
        });

        const { getCellWidths } = this.context;
        const baseRowCellWidths = getCellWidths(columns, null, true);

        return (
            <BaseRow
                components={components}
                virtualized={virtualized}
                index={index}
                onRow={this.onRow}
                expanded={expanded}
                expandIcon
                isSection
                record={record}
                replaceClassName={rowCls}
                expandableRow
                renderExpandIcon={this.renderExpandIcon}
                rowKey={groupKey}
                columns={columns}
                store={store}
                style={style}
                cellWidths={baseRowCellWidths}
            />
        );
    }
}

export default SectionRow;
