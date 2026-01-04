import React, { PureComponent } from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import { cssClasses, strings } from '@douyinfe/semi-foundation/list/constants';
import getDataAttr from '@douyinfe/semi-foundation/utils/getDataAttr';
import { noop } from 'lodash';
import { Col } from '../grid';
import ListContext, { ListContextValue } from './list-context';

export interface ListItemProps {
    extra?: React.ReactNode;
    header?: React.ReactNode;
    main?: React.ReactNode;
    align?: 'flex-start' | 'flex-end' | 'center' | 'baseline' | 'stretch';
    className?: string;
    children?: React.ReactNode;
    style?: React.CSSProperties;
    onClick?: React.MouseEventHandler<HTMLLIElement>;
    onRightClick?: React.MouseEventHandler<HTMLLIElement>;
    onMouseLeave?: React.MouseEventHandler<HTMLLIElement>;
    onMouseEnter?: React.MouseEventHandler<HTMLLIElement>
}

const prefixCls = cssClasses.PREFIX;
export default class ListItem extends PureComponent<ListItemProps> {
    static contextType = ListContext;

    static propTypes = {
        extra: PropTypes.node,
        header: PropTypes.node,
        main: PropTypes.node,
        align: PropTypes.oneOf(strings.ALIGN),
        className: PropTypes.string,
        children: PropTypes.node,
        style: PropTypes.object,
        onClick: PropTypes.func,
        onRightClick: PropTypes.func,
        onMouseEnter: PropTypes.func,
        onMouseLeave: PropTypes.func,
    };

    static defaultProps = {
        align: 'flex-start',
        onMouseEnter: noop,
        onMouseLeave: noop,
    };

    context: ListContextValue;

    wrapWithGrid(content: React.ReactNode) {
        const { grid } = this.context;
        const { gutter, justify, type, align, ...rest } = grid;
        return (
            <Col {...rest}>
                {content}
            </Col>
        );
    }

    render() {
        const {
            header,
            main,
            className,
            style,
            extra,
            children,
            align,
            onClick,
            onRightClick,
            onMouseEnter,
            onMouseLeave,
            ...rest
        } = this.props;
        const { onRightClick: contextOnRightClick, onClick: contextOnClick, grid: contextGrid } = this.context;
        const handleContextMenu = onRightClick ? onRightClick : contextOnRightClick;
        const handleClick = onClick ? onClick : contextOnClick;
        const itemCls = cls(`${prefixCls}-item`, className);
        const bodyCls = cls(`${prefixCls}-item-body`,
            {
                [`${prefixCls}-item-body-${align}`]: align,
            }
        );
        let body;
        if (header || main) {
            body = (
                <div className={bodyCls}>
                    {header ? <div className={`${prefixCls}-item-body-header`}>{header}</div> : null}
                    {main ? <div className={`${prefixCls}-item-body-main`}>{main}</div> : null}
                </div>
            );
        }
        let content = (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
            <li
                className={itemCls}
                style={style}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                {...getDataAttr(rest)}
            >
                {body ? body : null}
                {children}
                {extra ? <div className={`${prefixCls}-item-extra`}>{extra}</div> : null}
            </li>
        );

        if (this.context && contextGrid) {
            content = this.wrapWithGrid(content);
        }

        return content;
    }
}