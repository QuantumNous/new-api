import React, { PureComponent, ReactNode, CSSProperties } from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import { strings, cssClasses } from '@douyinfe/semi-foundation/space/constants';
import '@douyinfe/semi-foundation/space/space.scss';
import { isString, isArray, isNumber } from 'lodash';
import { flatten } from './utils';
import getDataAttr from '@douyinfe/semi-foundation/utils/getDataAttr';

const prefixCls = cssClasses.PREFIX;

export type Align = 'start' | 'center' | 'end' | 'baseline';
export type Spacing = 'loose' | 'medium' | 'tight' | number;

export type SpaceProps = {
    wrap?: boolean;
    align?: Align;
    vertical?: boolean;
    spacing?: Spacing | Spacing[];
    children?: ReactNode;
    style?: CSSProperties;
    className?: string
};

class Space extends PureComponent<SpaceProps> {
    static propTypes = {
        wrap: PropTypes.bool,
        align: PropTypes.oneOf(strings.ALIGN_SET),
        vertical: PropTypes.bool,
        spacing: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.array]),
        children: PropTypes.node,
        style: PropTypes.object,
        className: PropTypes.string
    };

    static defaultProps = {
        vertical: false,
        wrap: false,
        spacing: 'tight',
        align: 'center'
    };

    render(): ReactNode {
        const {
            children = null,
            style,
            className,
            spacing,
            wrap,
            align,
            vertical
        } = this.props;
        const isWrap = wrap && vertical ? false : wrap;
        const realStyle = { ...style };
        let spacingHorizontalType = '';
        let spacingVerticalType = '';
        if (isString(spacing)) {
            spacingHorizontalType = spacing;
            spacingVerticalType = spacing;
        } else if (isNumber(spacing)) {
            realStyle.rowGap = spacing;
            realStyle.columnGap = spacing;
        } else if (isArray(spacing)) {
            if (isString(spacing[0])) {
                spacingHorizontalType = spacing[0];
            } else if (isNumber(spacing[0])) {
                realStyle.columnGap = `${spacing[0]}px`;
            }
            if (isString(spacing[1])) {
                spacingVerticalType = spacing[1];
            } else if (isNumber(spacing[1])) {
                realStyle.rowGap = `${spacing[1]}px`;
            }
        }
        const classNames = cls(prefixCls, className, {
            [`${prefixCls}-align-${align}`]: align,
            [`${prefixCls}-vertical`]: vertical,
            [`${prefixCls}-horizontal`]: !vertical,
            [`${prefixCls}-wrap`]: isWrap,
            [`${prefixCls}-tight-horizontal`]: spacingHorizontalType === strings.SPACING_TIGHT,
            [`${prefixCls}-tight-vertical`]: spacingVerticalType === strings.SPACING_TIGHT,
            [`${prefixCls}-medium-horizontal`]: spacingHorizontalType === strings.SPACING_MEDIUM,
            [`${prefixCls}-medium-vertical`]: spacingVerticalType === strings.SPACING_MEDIUM,
            [`${prefixCls}-loose-horizontal`]: spacingHorizontalType === strings.SPACING_LOOSE,
            [`${prefixCls}-loose-vertical`]: spacingVerticalType === strings.SPACING_LOOSE,
        });
        const childrenNodes = flatten(children);
        const dataAttributes = getDataAttr(this.props);
        return (
            <div {...dataAttributes} className={classNames} style={realStyle} x-semi-prop="children">
                {childrenNodes}
            </div>
        );
    }
}

export default Space;