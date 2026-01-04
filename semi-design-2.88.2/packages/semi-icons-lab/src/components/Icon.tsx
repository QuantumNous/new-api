import React, { ReactNode, Ref, CSSProperties, DetailedHTMLProps, ComponentType } from 'react';
import { BASE_CLASS_PREFIX } from '../env';
import cls from 'classnames';
import '../styles/icons.scss';

export type IconSize = 'inherit' | 'extra-small' | 'small' | 'default' | 'large' | 'extra-large';

export interface IconProps extends DetailedHTMLProps<React.HTMLAttributes<HTMLSpanElement>, HTMLSpanElement> {
    svg: ReactNode;
    size?: IconSize;
    spin?: boolean;
    rotate?: number;
    prefixCls?: string;
    type?: string
}

const Icon = React.forwardRef<HTMLSpanElement, IconProps>((props, ref) => {
    const { svg, spin = false, rotate, style, className, prefixCls = BASE_CLASS_PREFIX, type, size = 'default', ...restProps } = props;
    const classes = cls(`${prefixCls}-icon`, {
        [`${prefixCls}-icon-extra-small`]: size === 'extra-small', // 8x8
        [`${prefixCls}-icon-small`]: size === 'small', // 12x12
        [`${prefixCls}-icon-default`]: size === 'default', // 16x16
        [`${prefixCls}-icon-large`]: size === 'large', // 20x20
        [`${prefixCls}-icon-extra-large`]: size === 'extra-large', // 24x24
        [`${prefixCls}-icon-spinning`]: spin === true,
        [`${prefixCls}-icon-${type}`]: Boolean(type)
    }, className);
    const outerStyle: CSSProperties = {
    };
    if (Number.isSafeInteger(rotate)) {
        outerStyle.transform = `rotate(${rotate}deg)`;
    }
    Object.assign(outerStyle, style);
    return <span role="img" ref={ref} aria-label={type} className={classes} style={outerStyle} {...restProps}>{svg}</span>;
});

// @ts-ignore used to judge whether it is a semi-icon in semi-ui
// custom icon case
Icon.elementType = 'Icon';

const convertIcon = (Svg: ComponentType, iconType: string) => {
    const InnerIcon = React.forwardRef<HTMLSpanElement, Omit<IconProps, 'svg' | 'type'>>((props, ref) =>
        <Icon svg={React.createElement(Svg)} type={iconType} ref={ref as any} {...props} />);
    // @ts-ignore used to judge whether it is a semi-icon in semi-ui 
    // builtin icon case
    InnerIcon.elementType = 'Icon';
    return InnerIcon;
};

export { convertIcon };
export default Icon;