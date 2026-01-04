import React from 'react';
import { cssClassesGroup, strings } from '@douyinfe/semi-foundation/floatButton/constants';
import '@douyinfe/semi-foundation/floatButton/floatButton.scss';
import BaseComponent from '../_base/baseComponent';
import { ArrayElement } from '../_base/base';
import Badge, { BadgeProps } from '../badge';
import cls from 'classnames';
import { FloatButtonProps } from './interface';

const prefixCls = cssClassesGroup.PREFIX;

export interface FloatButtonGroupItem extends FloatButtonProps {
    content?: string | React.ReactNode
}

export interface FloatButtonGroupProps {
    disabled?: boolean;
    items: FloatButtonGroupItem[];
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode
}

interface FloatButtonGroupState {
}

export default class FloatButtonGroup extends BaseComponent<FloatButtonGroupProps, FloatButtonGroupState> {

    static defaultProps = {
        shape: 'round',
        type: 'default',
        size: 'medium',
    };

    constructor(props: FloatButtonGroupProps) {
        super(props);
    }


    render(): JSX.Element {
        const { className, style, disabled, items } = this.props;
        return (
            <div 
                className={cls(prefixCls, className, {
                    [`${prefixCls}-disabled`]: disabled,
                })}
                style={style}
            >
                {items.map((item, index) => {
                    if (item.badge) {
                        return (
                            <Badge key={index} {...item.badge}>
                                <div className={cls(`${prefixCls}-item`)}>
                                    {item.icon}
                                    {item.content}
                                </div>
                            </Badge>
                        );
                    }
                    return (
                        <div
                            key={index} 
                            className={cls(`${prefixCls}-item`)}
                        >
                            {item.icon}
                            {item.content}
                        </div>
                    );}
                )}
            </div>
        );
    }
}
