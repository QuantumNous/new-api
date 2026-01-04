import React, { isValidElement, cloneElement, ReactNode } from 'react';
import BaseComponent, { BaseProps } from '../_base/baseComponent';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { cssClasses, strings } from '@douyinfe/semi-foundation/button/constants';
import { get } from 'lodash';
import { Type, Size, ButtonProps } from './Button';

import '@douyinfe/semi-foundation/button/button.scss';

export type Theme = 'solid' | 'borderless' | 'light' | 'outline';

export interface ButtonGroupProps extends BaseProps {
    disabled?: boolean;
    type?: Type;
    size?: Size;
    theme?: Theme;
    className?: string;
    children?: React.ReactNode;
    'aria-label'?: React.AriaAttributes['aria-label']
}

const prefixCls = cssClasses.PREFIX;
const btnSizes = strings.sizes;

export default class ButtonGroup extends BaseComponent<ButtonGroupProps> {
    static propTypes = {
        children: PropTypes.node,
        disabled: PropTypes.bool,
        type: PropTypes.string,
        size: PropTypes.oneOf(btnSizes),
        theme: PropTypes.oneOf(strings.themes),
        'aria-label': PropTypes.string,
    };

    static defaultProps = {
        // There are default values ​​for type and theme in Button. 
        // In order to allow users to individually customize the type and theme of the Button through the parameters of the Button in the ButtonGroup,
        // the default value of type and theme is not given in the ButtonGroup。
        size: 'default',
    };

    getInnerWithLine(inner) {
        const innerWithLine: ReactNode[] = [];
        if (inner.length > 1) {
            inner.slice(0, -1).forEach((item, index) => {
                const isButtonType = get(item, 'type.elementType') === 'Button';
                const buttonProps = get(item, 'props') as ButtonProps;
                const { type, theme, disabled } = buttonProps ?? {};
                if (isButtonType && theme !== 'outline') {
                    const lineCls = classNames(
                        `${prefixCls}-group-line`,
                        `${prefixCls}-group-line-${theme ?? 'light'}`,
                        `${prefixCls}-group-line-${type ?? 'primary'}`,
                        {
                            [`${prefixCls}-group-line-disabled`]: disabled,
                        }
                    );
                    innerWithLine.push(item, <span className={lineCls} key={`line-${index}`} />);
                } else {
                    innerWithLine.push(item);
                }
            });
            innerWithLine.push(inner.slice(-1));
            return innerWithLine;
        } else {
            return inner;
        }
    }

    render() {
        const { children, disabled, size, type, className, style, 'aria-label': ariaLabel, ...rest } = this.props;
        let inner: ReactNode[];
        let innerWithLine: ReactNode[] = [];
        const cls = classNames(`${prefixCls}-group`, className);

        if (children) {
            inner = ((Array.isArray(children) ? children : [children])).map((itm: React.ReactNode, index) => (
                isValidElement(itm)
                    ? cloneElement(itm, { disabled, size, type, ...itm.props, ...rest, key: itm.key ?? index })
                    : itm
            ));
            innerWithLine = this.getInnerWithLine(inner);
        }
        return <div className={cls} style={style} role="group" aria-label={ariaLabel}>{innerWithLine}</div>;
    }
}
