import React, { createRef, Fragment, ReactNode } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { get, noop, set, omit, merge, isEqual } from 'lodash';

import { cssClasses, numbers } from '@douyinfe/semi-foundation/table/constants';
import TableCellFoundation, { TableCellAdapter } from '@douyinfe/semi-foundation/table/cellFoundation';
import { isSelectionColumn, isExpandedColumn, getRTLAlign, shouldShowEllipsisTitle, getRTLFlexAlign } from '@douyinfe/semi-foundation/table/utils';

import BaseComponent, { BaseProps } from '../_base/baseComponent';
import Context, { TableContextProps } from './table-context';
import { amendTableWidth } from './utils';
import { ColumnProps, ExpandIcon } from './interface';

export interface TableCellProps extends BaseProps {
    record?: Record<string, any>;
    prefixCls?: string;
    index?: number; // index of dataSource
    fixedLeft?: boolean | number;
    lastFixedLeft?: boolean;
    fixedRight?: boolean | number;
    firstFixedRight?: boolean;
    indent?: number; // The level of the tree structure
    indentSize?: number; // Tree structure indent size
    column?: ColumnProps; // The column of the current cell
    /**
      * Does the first column include expandIcon
      * When hideExpandedColumn is true or isSection is true
      * expandIcon is a custom icon or true
      */
    expandIcon?: ExpandIcon;
    renderExpandIcon?: (record: Record<string, any>) => ReactNode;
    hideExpandedColumn?: boolean;
    component?: any;
    onClick?: (record: Record<string, any>, e: React.MouseEvent) => void; // callback of click cell event
    onDidUpdate?: (ref: React.MutableRefObject<any>) => void;
    isSection?: boolean; // Whether it is in group row
    width?: string | number; // cell width
    height?: string | number; // cell height
    selected?: boolean; // Whether the current row is selected
    expanded?: boolean; // Whether the current line is expanded
    disabled?: boolean;
    colIndex?: number
}

function isInvalidRenderCellText(text: any) {
    return text && !React.isValidElement(text) && Object.prototype.toString.call(text) === '[object Object]';
}

export default class TableCell extends BaseComponent<TableCellProps, Record<string, any>> {
    static contextType = Context;
    static defaultProps = {
        indent: 0,
        indentSize: numbers.DEFAULT_INDENT_WIDTH,
        onClick: noop,
        prefixCls: cssClasses.PREFIX,
        component: 'td',
        onDidUpdate: noop,
        column: {},
    };

    static propTypes = {
        record: PropTypes.object,
        prefixCls: PropTypes.string,
        index: PropTypes.number,
        fixedLeft: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
        lastFixedLeft: PropTypes.bool,
        fixedRight: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
        firstFixedRight: PropTypes.bool,
        indent: PropTypes.number,
        indentSize: PropTypes.number,
        column: PropTypes.object,
        expandIcon: PropTypes.any,
        renderExpandIcon: PropTypes.func,
        hideExpandedColumn: PropTypes.bool,
        component: PropTypes.any,
        onClick: PropTypes.func,
        onDidUpdate: PropTypes.func,
        isSection: PropTypes.bool,
        width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        selected: PropTypes.bool,
        expanded: PropTypes.bool,
        colIndex: PropTypes.number,
    };

    get adapter(): TableCellAdapter {
        return {
            ...super.adapter,
            notifyClick: (...args) => {
                const { onClick } = this.props;

                if (typeof onClick === 'function') {
                    onClick(...args);
                }
            },
        };
    }

    ref: React.MutableRefObject<any>;
    context: TableContextProps;

    constructor(props: TableCellProps) {
        super(props);
        this.ref = createRef();
        this.foundation = new TableCellFoundation(this.adapter);
    }

    /**
     * Control whether to execute the render function of the cell
     * 1. Scenes that return true
     *  - The cell contains the selection state, you need to calculate whether its selection state has changed during selection
     *  - The cell contains the folding state, it needs to be calculated when the folding state has changed
     * 2. Scenarios that return false
     *  - Cells without table operation operation status, only need to judge that their props have changed
     *    At this time, the update of the table cell is controlled by the user. At this time, its update will not affect other cells
     *
     * 控制是否执行cell的render函数
     * 1. 返回true的场景
     *  - cell内包含选择状态，需要在选择时计算它的选择态是否发生变化
     *  - cell内包含折叠状态，需要在折叠时计算它的折叠态是否发生了变化
     * 2. 返回false的场景
     *  - 没有table操作操作状态的cell，只需判断自己的props发生了变化
     *    此时table cell的更新由用户自己控制，此时它的更新不会影响其他cell
     *
     * @param {*} nextProps
     * @returns
     */
    shouldComponentUpdate(nextProps: TableCellProps) {
        const props = this.props;
        const { column, expandIcon } = props;
        const cellInSelectionColumn = isSelectionColumn(column);

        const { shouldCellUpdate } = column;
        if (typeof shouldCellUpdate === 'function') {
            return shouldCellUpdate(nextProps, props);
        }
        // The expand button may be in a separate column or in the first data column
        const columnHasExpandIcon = isExpandedColumn(column) || expandIcon;
        if ((cellInSelectionColumn || columnHasExpandIcon) && !isEqual(nextProps, this.props)) {
            return true;
        } else {
            const omitProps = ['selected', 'expanded', 'expandIcon', 'disabled'];
            const propsOmitSelected = omit(props, omitProps);
            const nextPropsOmitSelected = omit(nextProps, omitProps);
            if (!isEqual(nextPropsOmitSelected, propsOmitSelected)) {
                return true;
            }
        }
        return false;
    }

    componentDidUpdate() {
        this.props.onDidUpdate(this.ref);
    }

    setRef = (ref: React.MutableRefObject<any>) => (this.ref = ref);

    handleClick = (e: React.MouseEvent) => {
        this.foundation.handleClick(e);
        const customCellProps = this.adapter.getCache('customCellProps');
        if (customCellProps && typeof customCellProps.onClick === 'function') {
            customCellProps.onClick(e);
        }
    };

    getTdProps() {
        const {
            record,
            index,
            column = {},
            fixedLeft,
            fixedRight,
            width,
            height,
        } = this.props;

        let tdProps: { style?: Partial<React.CSSProperties> } = {};
        let customCellProps = {};
        const { direction } = this.context;
        const isRTL = direction === 'rtl';

        const fixedLeftFlag = fixedLeft || typeof fixedLeft === 'number';
        const fixedRightFlag = fixedRight || typeof fixedRight === 'number';

        if (fixedLeftFlag) {
            set(tdProps, isRTL ? 'style.right' : 'style.left', typeof fixedLeft === 'number' ? fixedLeft : 0);
        } else if (fixedRightFlag) {
            set(tdProps, isRTL ? 'style.left' : 'style.right', typeof fixedRight === 'number' ? fixedRight : 0);
        }

        if (width != null) {
            set(tdProps, 'style.width', width);
        }

        if (height != null) {
            set(tdProps, 'style.height', height);
        }

        if (column.onCell) {
            customCellProps = (column as any).onCell(record, index);
            this.adapter.setCache('customCellProps', { ...customCellProps });
            tdProps = { ...tdProps, ...omit(customCellProps, ['style', 'className', 'onClick']) };
            const customCellStyle = get(customCellProps, 'style') || {};
            tdProps.style = { ...tdProps.style, ...customCellStyle };
        }

        if (column.align) {
            const textAlign = getRTLAlign(column.align, direction);
            const justifyContent = getRTLFlexAlign(column.align, direction);
            tdProps.style = { ...tdProps.style, textAlign, justifyContent };
        }

        return { tdProps, customCellProps };
    }

    /**
     * We should return undefined if no dataIndex is specified, but in order to
     * be compatible with object-path's behavior, we return the record object instead.
     */
    renderText(tdProps: { style?: React.CSSProperties; colSpan?: number; rowSpan?: number }) {
        const {
            record,
            indentSize,
            prefixCls,
            indent,
            index,
            expandIcon,
            renderExpandIcon,
            column = {},
        } = this.props;
        const { dataIndex, render, useFullRender } = column;

        let text: any,
            colSpan: number,
            rowSpan: number;

        if (typeof dataIndex === 'number') {
            text = get(record, dataIndex);
        } else if (!dataIndex || dataIndex.length === 0) {
            text = record;
        } else {
            text = get(record, dataIndex);
        }

        const indentText = (indent && indentSize) ? (
            <span
                style={{ paddingLeft: `${indentSize * indent}px` }}
                className={`${prefixCls}-row-indent indent-level-${indent}`}
            />
        ) : null;

        // column.render
        const realExpandIcon = (typeof renderExpandIcon === 'function' ? renderExpandIcon(record) : expandIcon) as React.ReactNode;
        if (render) {
            const renderOptions = {
                expandIcon: realExpandIcon,
            };

            // column.useFullRender
            if (useFullRender) {
                const { renderSelection } = this.context;
                const realSelection = typeof renderSelection === 'function' ? renderSelection(record) : null;
                Object.assign(renderOptions, {
                    selection: realSelection,
                    indentText,
                });
            }

            text = render(text, record, index, renderOptions);
            if (isInvalidRenderCellText(text)) {
                tdProps = text.props ? merge(tdProps, text.props) : tdProps;
                colSpan = tdProps.colSpan;
                rowSpan = tdProps.rowSpan;
                text = text.children;
            }
        }

        return { text, indentText, rowSpan, colSpan, realExpandIcon, tdProps };
    }

    renderInner(text: ReactNode, indentText: ReactNode, realExpandIcon: ReactNode) {
        const {
            prefixCls,
            isSection,
            expandIcon,
            column = {},
        } = this.props;
        const { tableWidth, anyColumnFixed } = this.context;
        const { useFullRender } = column;

        let inner = null;

        if (useFullRender) {
            inner = text;
        } else {
            inner = [
                <Fragment key={'indentText'}>{indentText}</Fragment>,
                <Fragment key={'expandIcon'}>{expandIcon ? realExpandIcon : null}</Fragment>,
                <Fragment key={'text'}>{text}</Fragment>,
            ];
        }

        if (isSection) {
            inner = (
                <div
                    className={classnames(`${prefixCls}-section-inner`)}
                    style={{ width: anyColumnFixed ? amendTableWidth(tableWidth) : undefined }}
                >
                    {inner}
                </div>
            );
        }

        return inner;
    }

    render() {
        const {
            prefixCls,
            column = {},
            component: BodyCell,
            fixedLeft,
            fixedRight,
            lastFixedLeft,
            firstFixedRight,
            colIndex
        } = this.props;
        const { direction } = this.context;
        const isRTL = direction === 'rtl';
        const { className, ellipsis } = column;
        const fixedLeftFlag = fixedLeft || typeof fixedLeft === 'number';
        const fixedRightFlag = fixedRight || typeof fixedRight === 'number';
        const { tdProps, customCellProps } = this.getTdProps();

        const renderTextResult = this.renderText(tdProps);
        let { text } = renderTextResult;
        const { indentText, rowSpan, colSpan, realExpandIcon, tdProps: newTdProps } = renderTextResult;

        let title: string;

        const shouldShowTitle = shouldShowEllipsisTitle(ellipsis);
        if (shouldShowTitle) {
            if (typeof text === 'string') {
                title = text;
            }
        }

        if (rowSpan === 0 || colSpan === 0) {
            return null;
        }

        if (isInvalidRenderCellText(text)) {
            text = null;
        }

        const inner = this.renderInner(text, indentText, realExpandIcon);

        let isFixedLeft, isFixedLeftLast, isFixedRight, isFixedRightFirst;

        if (isRTL) {
            isFixedLeft = fixedRightFlag;
            isFixedLeftLast = firstFixedRight;
            isFixedRight = fixedLeftFlag;
            isFixedRightFirst = lastFixedLeft;
        } else {
            isFixedLeft = fixedLeftFlag;
            isFixedLeftLast = lastFixedLeft;
            isFixedRight = fixedRightFlag;
            isFixedRightFirst = firstFixedRight;
        }

        const columnCls = classnames(
            className,
            `${prefixCls}-row-cell`,
            get(customCellProps, 'className'),
            {
                [`${prefixCls}-cell-fixed-left`]: isFixedLeft,
                [`${prefixCls}-cell-fixed-left-last`]: isFixedLeftLast,
                [`${prefixCls}-cell-fixed-right`]: isFixedRight,
                [`${prefixCls}-cell-fixed-right-first`]: isFixedRightFirst,
                [`${prefixCls}-row-cell-ellipsis`]: ellipsis,
            }
        );

        return (
            <BodyCell
                role="gridcell"
                aria-colindex={colIndex + 1}
                className={columnCls}
                onClick={this.handleClick}
                title={title}
                {...newTdProps}
                ref={this.setRef}
            >
                {inner}
            </BodyCell>
        );
    }
}
