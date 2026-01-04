import React from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import { cssClasses, strings } from '@douyinfe/semi-foundation/list/constants';
import { noop } from 'lodash';
import '@douyinfe/semi-foundation/list/list.scss';
import LocaleConsumer from '../locale/localeConsumer';
import { Locale } from '../locale/interface';
import ListItem from './item';
import { Row } from '../grid';
import Spin from '../spin';
import ListContext, { Grid } from './list-context';
import BaseComponent from '../_base/baseComponent';

export type { ListItemProps } from './item';

export interface ListProps<T> {
    style?: React.CSSProperties;
    className?: string;
    children?: React.ReactNode;
    bordered?: boolean;
    footer?: React.ReactNode;
    header?: React.ReactNode;
    layout?: 'vertical' | 'horizontal';
    size?: 'small' | 'large' | 'default';
    split?: boolean;
    emptyContent?: React.ReactNode;
    dataSource?: T[];
    renderItem?: (item: T, ind: number) => React.ReactNode;
    grid?: Grid;
    loading?: boolean;
    loadMore?: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLLIElement>;
    onRightClick?: React.MouseEventHandler<HTMLLIElement>
}

const prefixCls = cssClasses.PREFIX;

class List<T = any> extends BaseComponent<ListProps<T>> {
    static Item = ListItem;

    static propTypes = {
        style: PropTypes.object,
        className: PropTypes.string,
        bordered: PropTypes.bool,
        footer: PropTypes.node,
        header: PropTypes.node,
        layout: PropTypes.oneOf(strings.LAYOUT),
        size: PropTypes.oneOf(strings.SIZE),
        split: PropTypes.bool,
        emptyContent: PropTypes.node,
        dataSource: PropTypes.array,
        renderItem: PropTypes.func,
        grid: PropTypes.object,
        loading: PropTypes.bool,
        loadMore: PropTypes.node,
        onRightClick: PropTypes.func,
        onClick: PropTypes.func,
    };

    static defaultProps = {
        bordered: false,
        split: true,
        loading: false,
        layout: 'vertical',
        size: 'default',
        onRightClick: noop,
        onClick: noop,
    };

    renderEmpty = () => {
        const { emptyContent } = this.props;
        if (emptyContent) {
            return (
                <div className={`${cssClasses.PREFIX}-empty`} x-semi-prop="emptyContent">
                    {emptyContent}
                </div>
            );
        } else {
            return (
                <LocaleConsumer componentName="List">
                    {
                        (locale: Locale['List']) => (
                            <div className={`${cssClasses.PREFIX}-empty`}>{locale.emptyText}</div>
                        )
                    }
                </LocaleConsumer>
            );
        }
    };

    wrapChildren(childrenList: React.ReactNode, children: React.ReactNode) {
        const { grid } = this.props;
        if (grid) {
            const rowProps = {};
            ['align', 'gutter', 'justify', 'type'].forEach(key => {
                if (key in grid) {
                    rowProps[key] = grid[key];
                }
            });
            return (
                <Row type="flex" {...rowProps}>
                    {childrenList ? childrenList : null}
                    {children}
                </Row>
            );
        }
        return (
            <ul className={`${prefixCls}-items`}>
                {childrenList ? childrenList : null}
                {children}
            </ul>
        );
    }

    render() {
        const {
            style,
            className,
            header,
            loading,
            onRightClick,
            onClick,
            footer,
            layout,
            grid,
            size,
            split,
            loadMore,
            bordered,
            dataSource,
            renderItem,
            children,
            ...rest
        } = this.props;
        const wrapperCls = cls(prefixCls, className, {
            [`${prefixCls}-flex`]: layout === 'horizontal',
            [`${prefixCls}-${size}`]: size,
            [`${prefixCls}-grid`]: grid,
            [`${prefixCls}-split`]: split,
            [`${prefixCls}-bordered`]: bordered,
        });
        let childrenList;
        if (dataSource && dataSource.length) {
            childrenList = [];
            const items = renderItem ? dataSource.map((item, index) => renderItem(item, index)) : [];
            React.Children.forEach(items as any, (child, index) => {
                const itemKey = child.key || `list-item-${index}`;
                childrenList.push(
                    React.cloneElement(child, {
                        key: itemKey,
                    })
                );
            });
        } else if (!children) {
            childrenList = this.renderEmpty();
        }
        return (
            <div className={wrapperCls} style={style} {...this.getDataAttr(rest)}>
                {header ? (
                    <div className={`${cssClasses.PREFIX}-header`} x-semi-prop="header">
                        {header}
                    </div>
                ) : null}
                <ListContext.Provider
                    value={{
                        grid,
                        onRightClick,
                        onClick,
                    }}
                >
                    <Spin spinning={loading} size="large">
                        {this.wrapChildren(childrenList, children)}
                    </Spin>
                </ListContext.Provider>
                {footer ? (
                    <div className={`${cssClasses.PREFIX}-footer`} x-semi-prop="footer">
                        {footer}
                    </div>
                ) : null}
                {loadMore ? loadMore : null}
            </div>
        );
    }
}

export default List;
