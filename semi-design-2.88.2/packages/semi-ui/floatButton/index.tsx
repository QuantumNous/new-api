/* eslint-disable jsx-a11y/no-static-element-interactions */
import React from 'react';
import { cssClasses } from '@douyinfe/semi-foundation/floatButton/constants';
import '@douyinfe/semi-foundation/floatButton/floatButton.scss';
import BaseComponent from '../_base/baseComponent';
import Badge from '../badge';
import cls from 'classnames';
import { FloatButtonProps } from './interface';

const prefixCls = cssClasses.PREFIX;

interface FloatButtonState {
}

export default class FloatButton extends BaseComponent<FloatButtonProps, FloatButtonState> {

    static defaultProps = {
        shape: 'round',
        colorful: false,
        size: 'default',
    };

    constructor(props: FloatButtonProps) {
        super(props);
    }

    handleClick = (e: React.MouseEvent) => {
        const { href, target, onClick, disabled } = this.props;
        
        if (disabled) {
            return;
        }

        // 如果有 href，执行跳转
        if (href) {
            if (target === '_blank') {
                window.open(href, '_blank');
            } else {
                window.location.href = href;
            }
        }

        // 如果有 onClick 回调，执行它
        if (onClick) {
            onClick();
        }
    };

    render(): JSX.Element {
        const { className, style, colorful, size, icon, badge, shape, disabled } = this.props;
        const body = <div 
            className={cls(
                `${prefixCls}-body`,
                {
                    [`${prefixCls}-${shape}`]: shape,
                    [`${prefixCls}-colorful`]: colorful,
                    [`${prefixCls}-disabled`]: disabled,
                    [`${prefixCls}-${size}`]: size,
                }
            )}>{icon}</div>;

        return (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <div
                style={style} 
                className={cls(prefixCls, className, {
                    [`${prefixCls}-${size}`]: size,
                    [`${prefixCls}-${shape}`]: shape,
                })}
                onClick={this.handleClick}
            >
                {badge ? <Badge {...badge}>{body}</Badge> : body}
            </div>
        );
    }
}
