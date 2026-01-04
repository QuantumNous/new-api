/**
 * Implementation reference from: https://github.com/ant-design/ant-design/blob/master/components/grid/col.tsx
 */
import React from 'react';
import PropTypes from 'prop-types';
import { RowContext, RowContextType } from './row';
import classnames from 'classnames';
import { cssClasses } from '@douyinfe/semi-foundation/grid/constants';

const objectOrNumber = PropTypes.oneOfType([PropTypes.object, PropTypes.number]);

export interface ColSize {
    span?: number;
    order?: number;
    offset?: number;
    push?: number;
    pull?: number
}

export interface ColProps {
    span?: number;
    order?: number;
    offset?: number;
    push?: number;
    pull?: number;
    className?: string;
    prefixCls?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
    xs?: number | ColSize;
    sm?: number | ColSize;
    md?: number | ColSize;
    lg?: number | ColSize;
    xl?: number | ColSize;
    xxl?: number | ColSize
}

class Col extends React.Component<ColProps> {
    static contextType = RowContext;

    static propTypes = {
        span: PropTypes.number,
        order: PropTypes.number,
        offset: PropTypes.number,
        push: PropTypes.number,
        pull: PropTypes.number,
        className: PropTypes.string,
        children: PropTypes.node,
        xs: objectOrNumber,
        sm: objectOrNumber,
        md: objectOrNumber,
        lg: objectOrNumber,
        xl: objectOrNumber,
        xxl: objectOrNumber,
        prefixCls: PropTypes.string,
    };

    static defaultProps = {
        prefixCls: cssClasses.PREFIX,
    };

    context: RowContextType;

    render() {
        const { props } = this;
        const { prefixCls, span, order, offset, push, pull, className, children, ...others } = props;

        let sizeClassObj = {};

        const prefix = `${prefixCls}-col`;

        ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'].forEach(size => {
            let sizeProps: ColSize = {};
            if (typeof props[size] === 'number') {
                sizeProps.span = props[size];
            } else if (typeof props[size] === 'object') {
                sizeProps = props[size] || {};
            }

            delete others[size];

            sizeClassObj = {
                ...sizeClassObj,
                [`${prefix}-${size}-${sizeProps.span}`]: sizeProps.span !== undefined,
                [`${prefix}-${size}-order-${sizeProps.order}`]: sizeProps.order || sizeProps.order === 0,
                [`${prefix}-${size}-offset-${sizeProps.offset}`]: sizeProps.offset || sizeProps.offset === 0,
                [`${prefix}-${size}-push-${sizeProps.push}`]: sizeProps.push || sizeProps.push === 0,
                [`${prefix}-${size}-pull-${sizeProps.pull}`]: sizeProps.pull || sizeProps.pull === 0,
            };
        });
        const classes = classnames(
            prefix,
            {
                [`${prefix}-${span}`]: span !== undefined,
                [`${prefix}-order-${order}`]: order,
                [`${prefix}-offset-${offset}`]: offset,
                [`${prefix}-push-${push}`]: push,
                [`${prefix}-pull-${pull}`]: pull,
            },
            className,
            sizeClassObj
        );
        let { style } = others;
        let gutters;
        try {
            gutters = this.context.gutters;
        } catch (error) {
            throw new Error('please make sure <Col> inside <Row>');
        }

        style = {
            ...(gutters[0] > 0 ?
                {
                    paddingLeft: gutters[0] / 2,
                    paddingRight: gutters[0] / 2,
                } :
                {}),
            ...(gutters[1] > 0 ?
                {
                    paddingTop: gutters[1] / 2,
                    paddingBottom: gutters[1] / 2,
                } :
                {}),
            ...style,
        };

        return (
            <div {...others} style={style} className={classes} x-semi-prop="children">
                {children}
            </div>
        );
    }
}

export default Col;
