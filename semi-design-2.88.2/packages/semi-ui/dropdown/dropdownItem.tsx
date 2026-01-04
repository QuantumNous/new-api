import React from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import { cssClasses as css, strings } from '@douyinfe/semi-foundation/dropdown/constants';
import DropdownContext from './context';
import BaseComponent from '../_base/baseComponent';
import { IconTick } from '@douyinfe/semi-icons';
import { noop } from 'lodash';

import type { BaseProps } from '../_base/baseComponent';
import type { DropdownContextType } from './context';

export type Type = 'primary' | 'secondary' | 'tertiary' | 'warning' | 'danger';

export interface DropdownItemProps extends BaseProps {
    disabled?: boolean;
    selected?: boolean;
    onClick?: React.MouseEventHandler<HTMLLIElement>;
    onMouseEnter?: React.MouseEventHandler<HTMLLIElement>;
    onMouseLeave?: React.MouseEventHandler<HTMLLIElement>;
    onContextMenu?: React.MouseEventHandler<HTMLLIElement>;
    forwardRef?: (ele: HTMLLIElement) => void;
    type?: Type;
    active?: boolean;
    icon?: React.ReactNode;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    showTick?: boolean;
    /** internal prop, please do not use  */
    hover?: boolean
}

const prefixCls = css.PREFIX;

class DropdownItem extends BaseComponent<DropdownItemProps> {

    static propTypes = {
        children: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
        name: PropTypes.string,
        disabled: PropTypes.bool,
        selected: PropTypes.bool,
        onClick: PropTypes.func,
        onMouseEnter: PropTypes.func,
        onMouseLeave: PropTypes.func,
        onContextMenu: PropTypes.func,
        className: PropTypes.string,
        style: PropTypes.object,
        forwardRef: PropTypes.func,
        type: PropTypes.oneOf(strings.ITEM_TYPE),
        active: PropTypes.bool,
        icon: PropTypes.node,
    };

    static contextType = DropdownContext;
    static elementType: string;

    context: DropdownContextType;

    static defaultProps = {
        disabled: false,
        divided: false,
        selected: false,
        onMouseEnter: noop,
        onMouseLeave: noop,
        forwardRef: noop,
    };


    render() {
        const {
            children,
            disabled,
            className,
            forwardRef,
            style,
            type,
            active,
            icon,
            onKeyDown,
            showTick,
            hover
        } = this.props;
        const { showTick: contextShowTick } = this.context;
        const realShowTick = contextShowTick ?? showTick;
        const itemclass = cls(className, {
            [`${prefixCls}-item`]: true,
            [`${prefixCls}-item-disabled`]: disabled,
            [`${prefixCls}-item-hover`]: hover,
            [`${prefixCls}-item-withTick`]: realShowTick,
            [`${prefixCls}-item-${type}`]: type,
            [`${prefixCls}-item-active`]: active,
        });

        const events = {};
        if (!disabled) {
            ['onClick', 'onMouseEnter', 'onMouseLeave', 'onContextMenu'].forEach(eventName => {
                const isInAnotherDropdown = this.context.level !== 1;
                if (isInAnotherDropdown && eventName === "onClick") {
                    events["onMouseDown"] = (e: React.MouseEvent<HTMLLIElement, MouseEvent>) => {
                        if (e.button === 0) {
                            this.props[eventName]?.(e);
                        }
                    };
                } else {
                    events[eventName] = this.props[eventName];
                }
            });
        }
        let tick = null;
        switch (true) {
            case realShowTick && active:
                tick = <IconTick/>;
                break;
            case realShowTick && !active:
                tick = <IconTick style={{ color: 'transparent' }}/>;
                break;
            default:
                tick = null;
                break;
        }
        let iconContent = null;
        if (icon) {
            iconContent = (
                <div className={`${prefixCls}-item-icon`}>
                    {icon}
                </div>
            );
        }
        return (
            <li role="menuitem" tabIndex={-1} aria-disabled={disabled} {...events} onKeyDown={onKeyDown}
                ref={ref => forwardRef(ref)} className={itemclass} style={style} {...this.getDataAttr(this.props)}>
                {tick}
                {iconContent}
                {children}
            </li>
        );
    }
}

DropdownItem.elementType = 'Dropdown.Item';

export default DropdownItem;
