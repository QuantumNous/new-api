import React, { cloneElement, Children, useMemo, isValidElement, ReactElement } from 'react';
import PropTypes from 'prop-types';
import getDataAttr from '@douyinfe/semi-foundation/utils/getDataAttr';
import cls from 'classnames';
import { stepsClasses as css } from '@douyinfe/semi-foundation/steps/constants';

export type Size = 'default' | 'small';
export interface NavStepsProps {
    prefixCls?: string;
    className?: string;
    style?: React.CSSProperties;
    current?: number;
    initial?: number;
    size?: Size;
    children?: React.ReactNode;
    onChange?: (current: number) => void;
    "aria-label"?: string
}

const Steps = (props: NavStepsProps) => {
    const { size = 'default', current = 0, initial = 0, children, prefixCls = css.PREFIX, className, style, onChange, ...rest } = props;
    const inner = useMemo(() => {
        const filteredChildren = Children.toArray(children).filter(c => isValidElement(c)) as Array<ReactElement<any>>;
        const total = filteredChildren.length;
        const content = Children.map(filteredChildren, (child: React.ReactElement<any>, index) => {
            if (!child) {
                return null;
            }
            const childProps = {
                index,
                total,
                ...child.props,
            };
            childProps.active = index === current;
            childProps.onChange = onChange ? () => {
                if (index !== current) {
                    onChange(index + initial);
                }
            } : undefined;
            return cloneElement(child, { ...childProps });
        });
        return content;
    }, [children, prefixCls, current, size, initial, onChange]);

    const wrapperCls = cls(className, {
        [`${prefixCls}-nav`]: true,
        [`${prefixCls}-${size}`]: size !== 'default',
    });

    return (
        <div aria-label={props["aria-label"]} className={wrapperCls} style={style} {...getDataAttr(rest)}>
            {inner}
        </div>
    );
};


export default Steps;
