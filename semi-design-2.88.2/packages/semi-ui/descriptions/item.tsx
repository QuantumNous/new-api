import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { cssClasses } from '@douyinfe/semi-foundation/descriptions/constants';
import '@douyinfe/semi-foundation/descriptions/descriptions.scss';
import getDataAttr from '@douyinfe/semi-foundation/utils/getDataAttr';
import DescriptionsContext, { DescriptionsContextValue } from './descriptions-context';

export interface DescriptionsItemProps {
    hidden?: boolean;
    className?: string;
    children?: React.ReactNode | (() => React.ReactNode);
    style?: React.CSSProperties;
    itemKey?: React.ReactNode;
    span?: number
}

const prefixCls = cssClasses.PREFIX;
const keyCls = `${prefixCls}-key`;
const valCls = `${prefixCls}-value`;

export default class Item extends PureComponent<DescriptionsItemProps> {
    static propTypes = {
        itemKey: PropTypes.node,
        hidden: PropTypes.bool,
        className: PropTypes.string,
        style: PropTypes.object
    };

    static contextType = DescriptionsContext;

    context: DescriptionsContextValue;

    render() {
        const { itemKey, hidden, className, span, style, children, ...rest } = this.props;
        const { align, layout } = this.context;
        if (hidden) {
            return null;
        }
        const plainItem = <td className={`${prefixCls}-item`} colSpan={span || 1}>
            <span className={keyCls}>
                {itemKey}:
            </span>
            <span className={valCls}>
                {typeof children === 'function' ? children() : children}
            </span>
        </td>;
        const alignItem = <>
            <th className={`${prefixCls}-item ${prefixCls}-item-th`}>
                <span className={keyCls}>
                    {itemKey}
                </span>
            </th>
            <td className={`${prefixCls}-item ${prefixCls}-item-td`} colSpan={span? ((span * 2) - 1) : 1}>
                <span className={valCls}>
                    {typeof children === 'function' ? children() : children}
                </span>
            </td>
        </>;
        const item = align === 'plain' ?
            (
                <tr className={className} style={style} {...getDataAttr(rest)}>
                    {plainItem}
                </tr>
            ) :
            (
                <tr className={className} style={style} {...getDataAttr(rest)}>
                    {alignItem}
                </tr>
            );
        const horizontalItem = align === 'plain' ? plainItem : alignItem;
        return layout === 'horizontal' ? horizontalItem : item;
    }
}
