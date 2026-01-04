import React from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import { cssClasses, strings } from '@douyinfe/semi-foundation/input/constants';
import BaseComponent from '../_base/baseComponent';
import Label, { LabelProps } from '../form/label';

import { noop } from '@douyinfe/semi-foundation/utils/function';
import { get, isFunction } from 'lodash';

const prefixCls = cssClasses.PREFIX;
const sizeSet = strings.SIZE;

export type InputSize = 'small' | 'large' | 'default';

export interface InputGroupProps {
    className?: string;
    children?: React.ReactNode;
    size?: InputSize;
    style?: Record<string, any>;
    onBlur?: (e: React.FocusEvent<HTMLSpanElement>) => void;
    onFocus?: (e: React.FocusEvent<HTMLSpanElement>) => void;
    label?: LabelProps;
    labelPosition?: string;
    disabled?: boolean
}

export interface InputGroupState {} 

export default class inputGroup extends BaseComponent<InputGroupProps, InputGroupState> {
    static propTypes = {
        className: PropTypes.string,
        children: PropTypes.node,
        size: PropTypes.oneOf(sizeSet),
        style: PropTypes.object,
        onBlur: PropTypes.func,
        onFocus: PropTypes.func,
        label: PropTypes.object,
        labelPosition: PropTypes.string,
    };

    static defaultProps = {
        size: 'default',
        className: '',
        onBlur: noop,
        onFocus: noop,
    };

    renderGroupWithLabel(inner: React.ReactNode) {
        const { size, className, label, labelPosition, ...rest } = this.props;
        const groupWrapperCls = cls({
            [`${prefixCls}-group-wrapper`]: true,
            [`${prefixCls}-group-wrapper-with-top-label`]: labelPosition === 'top',
            [`${prefixCls}-group-wrapper-with-left-label`]: labelPosition === 'left',
        });
        const groupCls = cls(
            `${prefixCls}-group`,
            className,
            {
                [`${prefixCls}-${size}`]: size !== 'default',
            }
        );
        // const labelCls = cls(label.className, '');
        const defaultName = 'input-group';
        return (
            <div className={groupWrapperCls}>
                {label && label.text ? <Label name={defaultName} {...label} /> : null}
                <span
                    role="group"
                    aria-disabled={this.props.disabled}
                    id={label && label.name || defaultName}
                    className={groupCls}
                    style={this.props.style}
                    onFocus={this.props.onFocus}
                    onBlur={this.props.onBlur}
                >
                    {inner}
                </span>
            </div>
        );
    }

    render() {
        const { size, style, className, children, label, onBlur: groupOnBlur, onFocus: groupOnFocus, disabled: groupDisabled, ...rest } = this.props;
        const groupCls = cls(
            `${prefixCls}-group`,
            {
                [`${prefixCls}-${size}`]: size !== 'default',
            },
            className
        );
        let inner;
        if (children) {
            inner = (Array.isArray(children) ? children : [children]).map((item, index) => {
                if (item) {
                    const { onBlur: itemOnBlur, onFocus: itemOnFocus, disabled: itemDisabled } = (item as any).props;
                    const onBlur = isFunction(itemOnBlur) && get(itemOnBlur, 'name') !== 'noop' ? itemOnBlur : groupOnBlur;
                    const onFocus = isFunction(itemOnFocus) && get(itemOnFocus, 'name') !== 'noop' ? itemOnFocus : groupOnFocus;
                    const disabled = typeof itemDisabled === 'boolean' ? itemDisabled : groupDisabled;
                    return React.cloneElement(item as any, { key: index, ...rest, size, onBlur, onFocus, disabled });
                }
                return null;
            });
        }

        if (label && label.text) {
            return this.renderGroupWithLabel(inner);
        }

        return (
            <span
                role="group"
                aria-label="Input group"
                aria-disabled={this.props.disabled}
                className={groupCls}
                style={style}
                onFocus={this.props.onFocus}
                onBlur={this.props.onBlur}
            >
                {inner}
            </span>
        );
    }
}