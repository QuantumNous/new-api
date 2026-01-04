import React, { isValidElement } from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import { strings, cssClasses } from '@douyinfe/semi-foundation/descriptions/constants';
import '@douyinfe/semi-foundation/descriptions/descriptions.scss';
import getDataAttr from '@douyinfe/semi-foundation/utils/getDataAttr';
import { isPlainObject } from 'lodash';
import DescriptionsContext, { DescriptionsAlign, DescriptionLayout } from './descriptions-context';
import Item from './item';
import DescriptionsFoundation, { DescriptionsAdapter } from "@douyinfe/semi-foundation/descriptions/foundation";
import BaseComponent from '../_base/baseComponent';

export type { DescriptionsItemProps } from './item';
export type DescriptionsSize = 'small' | 'medium' | 'large';

export interface Data {
    key?: React.ReactNode;
    value?: (() => React.ReactNode) | React.ReactNode;
    hidden?: boolean;
    span?: number
}
export interface DescriptionsProps {
    align?: DescriptionsAlign;
    row?: boolean;
    size?: DescriptionsSize;
    style?: React.CSSProperties;
    className?: string;
    children?: React.ReactNode;
    data?: Data[];
    layout?: DescriptionLayout;
    column?: number
}

const prefixCls = cssClasses.PREFIX;

class Descriptions extends BaseComponent<DescriptionsProps> {
    static Item = Item;

    static contextType = DescriptionsContext;

    static propTypes = {
        align: PropTypes.oneOf(strings.ALIGN_SET),
        row: PropTypes.bool,
        size: PropTypes.oneOf(strings.SIZE_SET),
        style: PropTypes.object,
        className: PropTypes.string,
        data: PropTypes.arrayOf(PropTypes.shape({
            key: PropTypes.node,
            value: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
            hidden: PropTypes.bool,
            className: PropTypes.string,
            style: PropTypes.object
        })),
        layout: PropTypes.oneOf(strings.LAYOUT_SET),
        column: PropTypes.number,
    };

    static defaultProps = {
        align: 'center',
        row: false,
        size: 'medium',
        data: [] as Array<Data>,
        layout: 'vertical',
        column: 3,
    };

    foundation: DescriptionsFoundation;

    constructor(props: DescriptionsProps) {
        super(props);
        this.foundation = new DescriptionsFoundation<DescriptionsProps>(this.adapter);
    }

    get adapter(): DescriptionsAdapter<DescriptionsProps> {
        return {
            ...super.adapter,
            getColumns: ()=>{
                if (this.props.data?.length) {
                    return this.props.data;
                }
                if (this.props.children) {
                    return React.Children.toArray(this.props.children)?.map(item => {
                        return isValidElement(item)?({
                            value: item.props.children,
                            ...item.props,
                        }):[];
                    });
                }
                return [];
            }
        };
    }

    renderChildrenList = () => {
        const props = this.props;
        const { layout, data, children } = props;
        if (layout === 'horizontal') {
            const horizontalList: Data[][] = this.foundation.getHorizontalList();
            return horizontalList.map((row, index)=> {
                return <tr key={index}>{
                    row.map((item, itemIndex)=>
                        isPlainObject(item) ? <Item itemKey={item.key} {...item} key={index+'-'+itemIndex}>{item.value}</Item> : null)
                }</tr>;
            });
        } else {
            return data && data.length ?
                data.map((item, index) => (
                    isPlainObject(item) ? <Item itemKey={item.key} {...item} key={index}>{item.value}</Item> : null
                )) :
                children;
        }
    };

    render() {
        const { align, row, size, className, style, children, data, layout, ...rest } = this.props;
        const classNames = cls(prefixCls, className, {
            [`${prefixCls}-${align}`]: !row,
            [`${prefixCls}-double`]: row,
            [`${prefixCls}-double-${size}`]: row,
            [`${prefixCls}-horizontal`]: layout === 'horizontal',
            [`${prefixCls}-vertical`]: layout === 'vertical'
        });

        return (
            <div className={classNames} style={style} {...getDataAttr(rest)}>
                <table>
                    <tbody>
                        <DescriptionsContext.Provider value={{ align, layout }}>
                            {this.renderChildrenList()}
                        </DescriptionsContext.Provider>
                    </tbody>
                </table>
            </div>
        );
    }
}

export default Descriptions;
