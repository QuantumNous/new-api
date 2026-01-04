import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { cssClasses, strings } from '@douyinfe/semi-foundation/card/constants';
import cls from 'classnames';
import Space from '../space';

const prefixcls = cssClasses.PREFIX;

export type CardGroupType = 'grid';

export interface CardGroupProps {
    /** Card group style class name */
    className?: string;
    children?: React.ReactNode;
    /** Card Spacing */
    spacing?: number | number[];
    /** Card group inline style */
    style?: React.CSSProperties;
    /** Card set type */
    type?: CardGroupType
}

class CardGroup extends PureComponent<CardGroupProps> {
    static propTypes = {
        children: PropTypes.node,
        className: PropTypes.string,
        spacing: PropTypes.oneOfType([PropTypes.number, PropTypes.array]),
        style: PropTypes.object,
        type: PropTypes.oneOf(strings.TYPE)
    };

    static defaultProps = {
        spacing: 16
    };

    render() {
        const {
            children,
            className,
            spacing,
            style,
            type,
            ...others
        } = this.props;
        const isGrid = type === 'grid';
        const cardGroupCls = cls(`${prefixcls}-group`, className, {
            [`${prefixcls}-group-grid`]: isGrid
        });

        return (
            <Space
                spacing={isGrid ? 0 : spacing}
                wrap={true}
                className={cardGroupCls}
                style={style}
                {...others}
            >
                {children}
            </Space>
        );
    }
}

export default CardGroup;