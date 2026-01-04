import React, { CSSProperties, ReactNode } from 'react';
import cls from 'classnames';
import { cssClasses } from '@douyinfe/semi-foundation/divider/constants';
import '@douyinfe/semi-foundation/divider/divider.scss';


const prefixCls = cssClasses.PREFIX;

export interface DividerProps {
    /** The position of title inside divider */
    align?: 'left' | 'right' | 'center';
    /** space between divider and surroundings **/
    margin?: number | string;
    /** The wrapped title */
    children?: ReactNode;
    /** Style class name */
    className?: string;
    /** Whether line is dashed  */
    dashed?: boolean;
    /** The direction type of divider */
    layout?: 'horizontal' | 'vertical';
    /** Divider inline style */
    style?: CSSProperties
}

const Divider: React.FC<DividerProps> = props => {
    const {
        layout = 'horizontal',
        dashed,
        align = 'center',
        className,
        margin,
        style,
        children,
        ...rest
    } = props;

    const dividerClassNames = cls(`${prefixCls}-divider`, className, {
        [`${prefixCls}-divider-horizontal`]: layout === 'horizontal',
        [`${prefixCls}-divider-vertical`]: layout === 'vertical',
        [`${prefixCls}-divider-dashed`]: !!dashed,
        [`${prefixCls}-divider-with-text`]: children && layout === 'horizontal',
        [`${prefixCls}-divider-with-text-${align}`]: children && layout === 'horizontal',
    });

    let overrideDefaultStyle: CSSProperties = {};
    if (margin !== undefined) {
        if (layout === 'vertical') {
            overrideDefaultStyle = {
                'marginLeft': margin,
                'marginRight': margin
            };
        } else if (layout === 'horizontal') {
            overrideDefaultStyle = {
                'marginTop': margin,
                'marginBottom': margin,
            };
        }
    }

    return (
        <div {...rest} className={dividerClassNames} style={{ ...overrideDefaultStyle, ...style }}>
            {children && layout === 'horizontal' ? (
                typeof children === 'string' ? (
                    <span className={`${prefixCls}-divider_inner-text`} x-semi-prop="children">
                        {children}
                    </span>
                ) : (
                    children
                )
            ) : null}
        </div>
    );
};

export default Divider;
