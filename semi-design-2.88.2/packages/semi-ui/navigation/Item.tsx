import BaseComponent, { BaseProps } from '../_base/baseComponent';
import React from 'react';
import PropTypes from 'prop-types';
import cls from 'classnames';
import { noop, times } from 'lodash';

import isNullOrUndefined from '@douyinfe/semi-foundation/utils/isNullOrUndefined';
import { cloneDeep, isSemiIcon } from '../_utils';
import ItemFoundation, {
    ItemAdapter,
    ItemProps,
    ItemKey,
    SelectedItemProps
} from '@douyinfe/semi-foundation/navigation/itemFoundation';
import { cssClasses, strings } from '@douyinfe/semi-foundation/navigation/constants';

import Tooltip from '../tooltip';
import NavContext, { NavContextType } from './nav-context';
import Dropdown from '../dropdown';

const clsPrefix = `${cssClasses.PREFIX}-item`;
interface NavItemProps extends ItemProps, Omit<BaseProps, 'children'> {
    disabled?: boolean;
    forwardRef?: (ele: HTMLLIElement) => void;
    icon?: React.ReactNode;
    itemKey?: ItemKey;
    level?: number;
    link?: string;
    linkOptions?: React.AnchorHTMLAttributes<HTMLAnchorElement>;
    tabIndex?: number; // on the site we change the tabindex to -1 in order to use gatsby's navigate link
    text?: React.ReactNode;
    tooltipHideDelay?: number;
    tooltipShowDelay?: number;

    onClick?(clickItems: SelectedData): void;

    onMouseEnter?: React.MouseEventHandler<HTMLLIElement>;
    onMouseLeave?: React.MouseEventHandler<HTMLLIElement>
}

interface SelectedData extends SelectedItemProps<NavItemProps> {
    text?: React.ReactNode
}

interface NavItemState {
    tooltipShow: boolean
}

export type { NavItemProps, ItemKey, NavItemState, SelectedData };
export default class NavItem extends BaseComponent<NavItemProps, NavItemState> {
    static contextType = NavContext;

    static propTypes = {
        text: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
        itemKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        onClick: PropTypes.func,
        onMouseEnter: PropTypes.func,
        onMouseLeave: PropTypes.func,
        icon: PropTypes.oneOfType([PropTypes.node]),
        className: PropTypes.string,
        toggleIcon: PropTypes.string,
        style: PropTypes.object,
        forwardRef: PropTypes.func,
        indent: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
        isCollapsed: PropTypes.bool, // Is it in a state of folding to the side
        isSubNav: PropTypes.bool, // Whether to navigate for children
        link: PropTypes.string,
        linkOptions: PropTypes.object,
        disabled: PropTypes.bool,
        tabIndex: PropTypes.number
    };

    static defaultProps = {
        isSubNav: false,
        indent: false,
        forwardRef: noop,
        isCollapsed: false,
        onClick: noop,
        onMouseEnter: noop,
        onMouseLeave: noop,
        disabled: false,
        tabIndex: 0
    };

    foundation: ItemFoundation;
    context: NavContextType;

    constructor(props: NavItemProps) {
        super(props);
        this.state = {
            tooltipShow: false,
        };
        this.foundation = new ItemFoundation(this.adapter);
    }

    _invokeContextFunc(funcName: string, ...args: any[]) {
        if (funcName && this.context && typeof this.context[funcName] === 'function') {
            return this.context[funcName](...args);
        }
        return null;
    }

    get adapter(): ItemAdapter<NavItemProps, NavItemState> {
        return {
            ...super.adapter,
            cloneDeep,
            updateTooltipShow: tooltipShow => this.setState({ tooltipShow }),
            updateSelected: _selected => this._invokeContextFunc('updateSelectedKeys', [this.props.itemKey]),
            updateGlobalSelectedKeys: keys => this._invokeContextFunc('updateSelectedKeys', [...keys]),
            getSelectedKeys: () => this.context && this.context.selectedKeys,
            getSelectedKeysIsControlled: () => this.context && this.context.selectedKeysIsControlled,
            notifyGlobalOnSelect: (...args) => this._invokeContextFunc('onSelect', ...args),
            notifyGlobalOnClick: (...args) => this._invokeContextFunc('onClick', ...args),
            notifyClick: (...args) => this.props.onClick(...args),
            notifyMouseEnter: (...args) => this.props.onMouseEnter(...args),
            notifyMouseLeave: (...args) => this.props.onMouseLeave(...args),
            getIsCollapsed: () => this.props.isCollapsed || Boolean(this.context && this.context.isCollapsed) || false,
            getSelected: () =>
                Boolean(this.context && this.context.selectedKeys && this.context.selectedKeys.includes(this.props.itemKey as string)),
            getIsOpen: () =>
                Boolean(this.context && this.context.openKeys && this.context.openKeys.includes(this.props.itemKey as string)),
        };
    }

    renderIcon(icon: React.ReactNode, pos: string, isToggleIcon = false, key: number | string = 0) {
        if (this.props.isSubNav) {
            return null;
        }

        if (!icon && this.context.mode === strings.MODE_HORIZONTAL) {
            return null;
        }

        let iconSize = 'large';
        if (pos === strings.ICON_POS_RIGHT) {
            iconSize = 'default';
        }

        const className = cls(`${clsPrefix}-icon`, {
            [`${clsPrefix}-icon-toggle-${this.context.toggleIconPosition}`]: isToggleIcon,
            [`${clsPrefix}-icon-info`]: !isToggleIcon
        });

        return (
            <i className={className} key={key}>
                {isSemiIcon(icon) ? React.cloneElement((icon as React.ReactElement<any>), { size: (icon as React.ReactElement<any>).props.size || iconSize }) : icon}
            </i>
        );
    }

    setItemRef = (ref: HTMLLIElement) => {
        // console.log('Item - setItemRef()', ref);
        this.props.forwardRef && this.props.forwardRef(ref);
    };

    wrapTooltip = (node: React.ReactNode) => {
        const { text, tooltipHideDelay, tooltipShowDelay } = this.props;
        const hideDelay = tooltipHideDelay ?? this.context.tooltipHideDelay;
        const showDelay = tooltipShowDelay ?? this.context.tooltipShowDelay;

        return (
            <Tooltip
                content={text}
                wrapWhenSpecial={false}
                position="right"
                trigger={'hover'}
                mouseEnterDelay={showDelay}
                mouseLeaveDelay={hideDelay}
            >
                {node}
            </Tooltip>
        );
    };

    handleClick = (e: React.MouseEvent) => this.foundation.handleClick(e);
    handleKeyPress = (e: React.KeyboardEvent) => this.foundation.handleKeyPress(e);

    render() {
        const {
            text,
            icon,
            toggleIcon,
            className,
            isSubNav,
            style,
            indent,
            onMouseEnter,
            onMouseLeave,
            link,
            linkOptions,
            disabled,
            level = 0,
            tabIndex
        } = this.props;

        const { mode, isInSubNav, prefixCls, limitIndent } = this.context;

        const isCollapsed = this.adapter.getIsCollapsed();

        const selected = this.adapter.getSelected();


        let itemChildren = null;
        // Children is not a recommended usage and may cause some bug-like performance, but some users have already used it, so here we only delete the ts definition instead of deleting the actual code
        // children 并不是我们推荐的用法，可能会导致一些像 bug的表现，但是有些用户已经用了，所以此处仅作删除 ts 定义而非删除实际代码的操作
        // refer https://github.com/DouyinFE/semi-design/issues/2710
        // @ts-ignore
        const children = this.props?.children;
        if (!isNullOrUndefined(children)) {
            itemChildren = children;
        } else {
            let placeholderIcons = null;
            if (mode === strings.MODE_VERTICAL && !limitIndent && !isCollapsed) {
                const iconAmount = (icon && !indent) ? level : level - 1;
                placeholderIcons = times(iconAmount, (index) => this.renderIcon(null, strings.ICON_POS_RIGHT, false, index));
            }
            itemChildren = (
                <>
                    {placeholderIcons}
                    {this.context.toggleIconPosition === strings.TOGGLE_ICON_LEFT && this.renderIcon(toggleIcon, strings.ICON_POS_RIGHT, true, 'key-toggle-pos-right')}
                    {icon || indent || isInSubNav ? this.renderIcon(icon, strings.ICON_POS_LEFT, false, 'key-position-left') : null}
                    {!isNullOrUndefined(text) ? <span className={`${cssClasses.PREFIX}-item-text`}>{text}</span> : ''}
                    {this.context.toggleIconPosition === strings.TOGGLE_ICON_RIGHT && this.renderIcon(toggleIcon, strings.ICON_POS_RIGHT, true, 'key-toggle-pos-right')}
                </>
            );
        }


        if (typeof link === 'string') {
            itemChildren = (
                <a className={`${prefixCls}-item-link`} href={link} tabIndex={-1} {...(linkOptions as any)}>
                    {itemChildren}
                </a>
            );
        }

        let itemDom: React.ReactNode = '';

        if (isInSubNav && (isCollapsed || mode === strings.MODE_HORIZONTAL)) {
            const popoverItemCls = cls({
                [clsPrefix]: true,
                [`${clsPrefix}-sub`]: isSubNav,
                [`${clsPrefix}-selected`]: selected,
                [`${clsPrefix}-collapsed`]: isCollapsed,
                [`${clsPrefix}-disabled`]: disabled,
            });

            itemDom = (
                <Dropdown.Item
                    selected={selected}
                    active={selected}
                    forwardRef={this.setItemRef}
                    className={popoverItemCls}
                    onClick={this.handleClick}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    disabled={disabled}
                    onKeyDown={this.handleKeyPress}
                >
                    {itemChildren}
                </Dropdown.Item>
            );
        } else {
            // Items are divided into normal and sub-wrap
            const popoverItemCls = cls(`${className || `${clsPrefix}-normal`}`, {
                [clsPrefix]: true,
                [`${clsPrefix}-sub`]: isSubNav,
                [`${clsPrefix}-selected`]: selected && !isSubNav,
                [`${clsPrefix}-collapsed`]: isCollapsed,
                [`${clsPrefix}-disabled`]: disabled,
                [`${clsPrefix}-has-link`]: typeof link === 'string',
            });
            const ariaProps = {
                'aria-disabled': disabled,
            };
            if (isSubNav) {
                const isOpen = this.adapter.getIsOpen();
                ariaProps['aria-expanded'] = isOpen;
            }

            itemDom = (
                // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                <li
                    // if role = menuitem, the narration will read all expanded li
                    role={isSubNav ? null : "menuitem"}
                    tabIndex={isSubNav ? -1 : tabIndex}
                    {...ariaProps}
                    style={style}
                    ref={this.setItemRef}
                    className={popoverItemCls}
                    onClick={this.handleClick}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    onKeyPress={this.handleKeyPress}
                    {...this.getDataAttr(this.props)}
                >
                    {itemChildren}
                </li>
            );
        }

        // Display Tooltip when disabled and SubNav
        if (isCollapsed && !isInSubNav && !isSubNav || isCollapsed && isSubNav && disabled) {
            itemDom = this.wrapTooltip(itemDom);
        }
        if (typeof this.context.renderWrapper === 'function') {
            return this.context.renderWrapper({
                itemElement: itemDom,
                isSubNav: isSubNav,
                isInSubNav: isInSubNav,
                props: this.props
            });
        }
        return itemDom;
    }
}
