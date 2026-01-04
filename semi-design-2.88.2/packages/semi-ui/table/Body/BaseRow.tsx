import React, { createRef, ReactNode } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { each, noop, get, stubTrue, omit, isEqual, pick } from 'lodash';

import { strings, cssClasses } from '@douyinfe/semi-foundation/table/constants';
import shallowEqualObjects from '@douyinfe/semi-foundation/utils/shallowEqualObjects';
import TableRowFoundation, { TableRowAdapter } from '@douyinfe/semi-foundation/table/tableRowFoundation';
import {
    isLastLeftFixed,
    arrayAdd,
    isFixedLeft,
    isFixedRight,
    isScrollbarColumn,
    isFirstFixedRight,
    isInnerColumnKey,
    isExpandedColumn
} from '@douyinfe/semi-foundation/table/utils';
import Store from '@douyinfe/semi-foundation/utils/Store';
import { BaseRowKeyType } from '@douyinfe/semi-foundation/table/foundation';

import BaseComponent from '../../_base/baseComponent';
import TableCell from '../TableCell';
import { ColumnProps, Fixed, TableComponents, Virtualized, ExpandIcon, OnRow, RowExpandable } from '../interface';

export interface BaseRowProps {
    anyColumnFixed?: boolean;
    cellWidths?: number[];
    className?: string;
    columns: ColumnProps[]; // required
    components?: TableComponents; // required
    disabled?: boolean;
    expandIcon?: ExpandIcon;
    expandableRow?: boolean;
    expanded?: boolean;
    expandedRow?: boolean;
    fixed?: Fixed;
    height?: string | number;
    hideExpandedColumn?: boolean;
    hovered: boolean; // required
    indent?: number;
    indentSize?: number;
    index?: number;
    isSection?: boolean;
    level?: number;
    onDidUpdate?: (ref: React.MutableRefObject<any>) => void;
    onHover?: (mouseEnter: boolean, rowKey: string | number) => void;
    onRow?: OnRow<any>;
    onRowClick?: (rowKey: BaseRowKeyType, e: React.MouseEvent, expand: boolean) => void;
    onRowDoubleClick?: (record: Record<string, any>, e: React.MouseEvent) => void;
    onRowMouseEnter?: (record: Record<string, any>, e: React.MouseEvent) => void;
    onRowMouseLeave?: (record: Record<string, any>, e: React.MouseEvent) => void;
    prefixCls?: string;
    record?: Record<string, any>;
    renderExpandIcon?: RenderExpandIcon;
    replaceClassName?: string;
    rowExpandable?: RowExpandable<any>;
    rowKey?: string | number; // required, this place rowKey is a real key of the row
    selected?: boolean;
    store?: Store;
    style?: React.CSSProperties;
    virtualized?: Virtualized;
    visible: boolean; // required
    /** whether display none */
    displayNone?: boolean
}

/**
 * avoid affected by https://www.npmjs.com/package/babel-plugin-transform-react-remove-prop-types
 */
export const baseRowPropTypes = {
    anyColumnFixed: PropTypes.bool,
    cellWidths: PropTypes.array.isRequired,
    className: PropTypes.string,
    columns: PropTypes.array.isRequired,
    components: PropTypes.object.isRequired,
    disabled: PropTypes.bool,
    expandIcon: PropTypes.oneOfType([PropTypes.bool, PropTypes.func, PropTypes.node]),
    expandableRow: PropTypes.bool,
    expanded: PropTypes.bool,
    displayNone: PropTypes.bool,
    expandedRow: PropTypes.bool,
    fixed: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
    height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    hideExpandedColumn: PropTypes.bool,
    hovered: PropTypes.bool.isRequired,
    indent: PropTypes.number,
    indentSize: PropTypes.number,
    index: PropTypes.number,
    isSection: PropTypes.bool,
    level: PropTypes.number,
    onDidUpdate: PropTypes.func,
    onHover: PropTypes.func,
    onRow: PropTypes.func,
    onRowClick: PropTypes.func,
    onRowContextMenu: PropTypes.func,
    onRowDoubleClick: PropTypes.func,
    onRowMouseEnter: PropTypes.func,
    onRowMouseLeave: PropTypes.func,
    prefixCls: PropTypes.string,
    record: PropTypes.object,
    renderExpandIcon: PropTypes.func,
    replaceClassName: PropTypes.string,
    rowExpandable: PropTypes.func,
    rowKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, // real key of the row
    selected: PropTypes.bool,
    store: PropTypes.object,
    style: PropTypes.object,
    virtualized: PropTypes.oneOfType([PropTypes.object, PropTypes.bool]),
    visible: PropTypes.bool.isRequired,
};

export default class TableRow extends BaseComponent<BaseRowProps, Record<string, any>> {
    static propTypes = baseRowPropTypes;

    static defaultProps = {
        columns: [] as [],
        rowExpandable: stubTrue,
        components: {
            body: {
                row: 'tr',
                cell: 'td',
            },
        },
        prefixCls: cssClasses.PREFIX,
        onRow: noop,
        onRowClick: noop,
        onRowDoubleClick: noop,
        onRowMouseEnter: noop,
        onRowMouseLeave: noop,
        onHover: noop,
        onDidUpdate: noop,
        visible: true,
        hovered: false,
        selected: false,
        disabled: false,
    };

    get adapter(): TableRowAdapter<BaseRowProps> {
        return {
            ...super.adapter,
            notifyClick: (...args) => this.props.onRowClick(...args),
            notifyDoubleClick: (...args) => this.props.onRowDoubleClick(...args),
            notifyMouseLeave: (...args) => {
                this.props.onHover(false, this.props.rowKey);
                this.props.onRowMouseEnter(...args);
            },
            notifyMouseEnter: (...args) => {
                this.props.onHover(true, this.props.rowKey);
                this.props.onRowMouseEnter(...args);
            },
        };
    }

    constructor(props: BaseRowProps) {
        super(props);
        this.foundation = new TableRowFoundation(this.adapter);
    }

    componentDidMount() {
        // fix #745
        // didmount/willUnmount may be called twice when React.StrictMode is true in React 18, we need to ensure that this.cache.customRowProps is correct
        const {
            onRow,
            index,
            record,
        } = this.props;
        const customRowProps = this.adapter.getCache('customRowProps');
        if (typeof customRowProps === 'undefined') {
            const { className: customClassName, style: customStyle, ...rowProps } = onRow(record, index) || {};
            this.adapter.setCache('customRowProps', { ...rowProps });
        }
    }

    shouldComponentUpdate(nextProps: BaseRowProps) {
        /**
          * Shallow comparison of incoming props to simulate PureComponent
          * Deep comparison cellWidths
          *
          * 浅层对比传入的 props，模拟 PureComponent
          * 深比较 cellWidths
          */
        const omitProps = ['cellWidths'];
        const isPropsShallowEqual = shallowEqualObjects(omit(nextProps, omitProps), omit(this.props, omitProps));
        if (!isPropsShallowEqual || !isEqual(pick(nextProps, omitProps), pick(this.props, omitProps))) {
            return true;
        }
        return false;
    }

    // Pass true to render the tree-shaped expand button
    renderExpandIcon = (record: Record<string, any>) => {
        const { renderExpandIcon } = this.props;
        return renderExpandIcon(record, true);
    };

    renderCells() {
        const {
            columns,
            record,
            index,
            prefixCls,
            fixed,
            components,
            expandableRow,
            level,
            expandIcon,
            rowExpandable,
            isSection,
            expandedRow,
            virtualized,
            indentSize,
            hideExpandedColumn,
            cellWidths,
            selected,
            expanded,
            disabled,
            onDidUpdate,
        } = this.props;

        const BodyCell = get(components, 'body.cell', strings.DEFAULT_COMPONENTS.body.cell);

        const cells: ReactNode[] = [];
        const displayExpandedColumn = rowExpandable(record);

        let firstIndex = 0;
        // const dataColumns = getDataColumns(columns);

        each(columns, (column, columnIndex) => {
            const columnKey = get(column, 'key');
            const expandableProps: { renderExpandIcon?: (record: Record<string, any>) => ReactNode; expandIcon?: ExpandIcon; indent?: number } = {};

            if (fixed !== 'right') {
                if (isInnerColumnKey(columnKey)) {
                    firstIndex++;
                }

                if (expandableRow && columnIndex === firstIndex) {
                    expandableProps.renderExpandIcon = this.renderExpandIcon;
                    if (hideExpandedColumn || isSection) {
                        expandableProps.expandIcon = expandIcon != null ? expandIcon : true;
                    }
                }

                // Only the first data row will be indented
                if (level != null && columnIndex === firstIndex) {
                    expandableProps.indent = level;
                    const isBool = typeof expandIcon === 'boolean';
                    const hasExpandIcon = expandIcon !== false || !isBool && expandIcon !== null;

                    // 如果 expandIcon 为空，不需要 indent
                    if (!expandableRow && hideExpandedColumn && hasExpandIcon) {
                        expandableProps.indent = level + 1;
                    }
                }
            }

            if (isExpandedColumn(column) && !displayExpandedColumn) {
                cells.push(<TableCell key={columnIndex} colIndex={columnIndex} isSection={isSection} />);
            } else if (!isScrollbarColumn(column)) {
                const diyProps: { width?: number } = {};

                if (BodyCell !== strings.DEFAULT_COMPONENTS.body.cell && virtualized && !expandedRow) {
                    diyProps.width = get(cellWidths, columnIndex);
                }

                cells.push(
                    <TableCell
                        colIndex={columnIndex}
                        {...expandableProps}
                        {...diyProps}
                        hideExpandedColumn={hideExpandedColumn}
                        indentSize={indentSize}
                        isSection={isSection}
                        prefixCls={`${prefixCls}`}
                        column={column}
                        key={columnIndex}
                        index={index}
                        record={record}
                        component={BodyCell}
                        fixedLeft={isFixedLeft(column) && arrayAdd(cellWidths, 0, columnIndex)}
                        lastFixedLeft={isLastLeftFixed(columns, column)}
                        fixedRight={isFixedRight(column) && arrayAdd(cellWidths, columnIndex + 1)}
                        firstFixedRight={isFirstFixedRight(columns, column)}
                        selected={selected}
                        expanded={expanded}
                        disabled={disabled}
                        onDidUpdate={onDidUpdate}
                    />
                );
            }
        });

        return cells;
    }

    handleMouseEnter = (e: React.MouseEvent) => {
        this.foundation.handleMouseEnter(e);

        const customRowProps = this.adapter.getCache('customRowProps');

        if (typeof customRowProps?.onMouseEnter === 'function') {
            customRowProps.onMouseEnter(e);
        }
    };

    handleMouseLeave = (e: React.MouseEvent) => {
        this.foundation.handleMouseLeave(e);

        const customRowProps = this.adapter.getCache('customRowProps');

        if (typeof customRowProps?.onMouseLeave === 'function') {
            customRowProps.onMouseLeave(e);
        }
    };

    handleClick = (e: React.MouseEvent) => {
        this.foundation.handleClick(e);

        const customRowProps = this.adapter.getCache('customRowProps');

        if (customRowProps && typeof customRowProps.onClick === 'function') {
            customRowProps.onClick(e);
        }
    };

    render() {
        const { style } = this.props;
        const {
            components,
            prefixCls,
            selected,
            onRow,
            index,
            className,
            replaceClassName,
            record,
            hovered,
            expanded,
            displayNone,
            expandableRow,
            level,
            expandedRow,
            isSection,
            rowKey
        } = this.props;

        const BodyRow = components.body.row;

        const { className: customClassName, style: customStyle, ...rowProps } = onRow(record, index) || {};

        this.adapter.setCache('customRowProps', { ...rowProps });

        const baseRowStyle = { ...style, ...customStyle };

        const rowCls =
            typeof replaceClassName === 'string' && replaceClassName.length
                ? classnames(replaceClassName, customClassName)
                : classnames(
                    className,
                    `${prefixCls}-row`,
                    {
                        [`${prefixCls}-row-selected`]: selected,
                        [`${prefixCls}-row-expanded`]: expanded,
                        [`${prefixCls}-row-hovered`]: hovered,
                        [`${prefixCls}-row-hidden`]: displayNone,
                    },
                    customClassName
                );
        const ariaProps = {};
        if (typeof index === 'number') {
            ariaProps['aria-rowindex'] = index + 1;
        }
        if (expandableRow) {
            ariaProps['aria-expanded'] = expanded;
        }
        // if row is expandedRow, set it's level to 2 
        if (expanded || expandedRow) {
            ariaProps['aria-level'] = 2;
        }
        if (typeof level === 'number') {
            ariaProps['aria-level'] = level + 1;
        }
        if (isSection) {
            ariaProps['aria-level'] = 1;
        }

        return (
            <BodyRow
                role="row"
                {...ariaProps}
                {...rowProps}
                style={baseRowStyle}
                className={rowCls}
                // used for dnd-kit sortable
                data-row-key={rowKey}
                onMouseEnter={this.handleMouseEnter}
                onMouseLeave={this.handleMouseLeave}
                onClick={this.handleClick}
            >
                {this.renderCells()}
            </BodyRow>
        );
    }
}

export type RenderExpandIcon = (record: Record<string, any>, isNested: boolean) => ReactNode | null;
