import React from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { cssClasses, strings, numbers } from '@douyinfe/semi-foundation/dropdown/constants';

import BaseComponent from '../_base/baseComponent';
import Tooltip, { Position, TooltipProps, Trigger } from '../tooltip/index';
import { numbers as tooltipNumbers } from '@douyinfe/semi-foundation/tooltip/constants';
import Foundation from '@douyinfe/semi-foundation/dropdown/foundation';

import DropdownMenu from './dropdownMenu';
import DropdownItem, { DropdownItemProps } from './dropdownItem';
import DropdownDivider, { DropdownDividerProps } from './dropdownDivider';
import DropdownTitle, { DropdownTitleProps } from './dropdownTitle';

import DropdownContext, { DropdownContextType } from './context';
import '@douyinfe/semi-foundation/dropdown/dropdown.scss';
import { noop, get } from 'lodash';
import { getDefaultPropsFromGlobalConfig } from "../_utils";

const positionSet = strings.POSITION_SET;
const triggerSet = strings.TRIGGER_SET;

export type { DropdownDividerProps } from './dropdownDivider';
export type { DropdownItemProps, Type } from './dropdownItem';
export type { DropdownMenuProps } from './dropdownMenu';
export type { DropdownTitleProps } from './dropdownTitle';

export interface DropDownMenuItemItem extends DropdownItemProps {
    node: 'item';
    name?: string
}
export interface DropDownMenuItemDivider extends DropdownDividerProps {
    node: 'divider'
}
export interface DropDownMenuItemTitle extends DropdownTitleProps {
    node: 'title';
    name?: string
}

export type DropDownMenuItem = DropDownMenuItemItem | DropDownMenuItemDivider | DropDownMenuItemTitle;

export interface DropdownProps extends TooltipProps {
    render?: React.ReactNode;
    children?: React.ReactNode;
    visible?: boolean;
    position?: Position;
    getPopupContainer?: () => HTMLElement;
    mouseEnterDelay?: number;
    mouseLeaveDelay?: number;
    menu?: DropDownMenuItem[];
    trigger?: Trigger;
    zIndex?: number;
    motion?: boolean;
    className?: string;
    contentClassName?: string | any[];
    style?: React.CSSProperties;
    onVisibleChange?: (visible: boolean) => void;
    rePosKey?: string | number;
    showTick?: boolean;
    closeOnEsc?: TooltipProps['closeOnEsc'];
    onEscKeyDown?: TooltipProps['onEscKeyDown']
}

interface DropdownState {
    popVisible: boolean
}

class Dropdown extends BaseComponent<DropdownProps, DropdownState> {
    static Menu = DropdownMenu;

    static Item = DropdownItem;

    static Divider = DropdownDivider;

    static Title = DropdownTitle;

    static contextType = DropdownContext;

    static propTypes = {
        children: PropTypes.node,
        contentClassName: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
        className: PropTypes.string,
        getPopupContainer: PropTypes.func,
        margin: PropTypes.oneOfType([PropTypes.number, PropTypes.object]),
        mouseEnterDelay: PropTypes.number,
        mouseLeaveDelay: PropTypes.number,
        menu: PropTypes.array,
        motion: PropTypes.oneOfType([PropTypes.bool, PropTypes.func, PropTypes.object]),
        onVisibleChange: PropTypes.func,
        prefixCls: PropTypes.string,
        position: PropTypes.oneOf(positionSet),
        rePosKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        render: PropTypes.node,
        spacing: PropTypes.oneOfType([PropTypes.number, PropTypes.object]),
        showTick: PropTypes.bool,
        style: PropTypes.object,
        trigger: PropTypes.oneOf(triggerSet),
        visible: PropTypes.bool,
        zIndex: PropTypes.number,
    };

    static __SemiComponentName__ = "Dropdown";

    static defaultProps = getDefaultPropsFromGlobalConfig(Dropdown.__SemiComponentName__, {
        onVisibleChange: noop,
        prefixCls: cssClasses.PREFIX,
        zIndex: tooltipNumbers.DEFAULT_Z_INDEX,
        motion: true,
        trigger: 'hover',
        position: 'bottom',
        mouseLeaveDelay: strings.DEFAULT_LEAVE_DELAY,
        showTick: false,
        closeOnEsc: true,
        onEscKeyDown: noop,
    });

    tooltipRef: React.RefObject<Tooltip>

    constructor(props: DropdownProps) {
        super(props);

        this.state = {
            popVisible: props.visible,
        };

        this.foundation = new Foundation(this.adapter);
        this.tooltipRef = React.createRef();
    }

    context: DropdownContextType;

    get adapter() {
        return {
            ...super.adapter,
            setPopVisible: (popVisible: boolean) => this.setState({ popVisible }),
            notifyVisibleChange: (visible: boolean) => this.props.onVisibleChange?.(visible),
            getPopupId: () => this.tooltipRef.current.getPopupId()
        };
    }

    handleVisibleChange = (visible: boolean) => this.foundation.handleVisibleChange(visible);

    renderContent() {
        const { render, menu, contentClassName, style, showTick, prefixCls, trigger } = this.props;
        const className = classnames(prefixCls, contentClassName);
        const { level = 0 } = this.context;
        const contextValue = { showTick, level: level + 1, trigger };
        let content = null;
        if (React.isValidElement(render)) {
            content = render;
        } else if (Array.isArray(menu)) {
            content = this.renderMenu();
        }
        return (
            <DropdownContext.Provider value={contextValue}>
                <div className={className} style={style}>
                    <div className={`${prefixCls}-content`} x-semi-prop="render">{content}</div>
                </div>
            </DropdownContext.Provider>
        );
    }

    renderMenu() {
        const { menu } = this.props;
        const content = menu.map((m, index) => {
            switch (m.node) {
                case 'title': {
                    const { name, node, ...rest } = m;
                    return (
                        <Dropdown.Title {...rest} key={node + name + index}>
                            {name}
                        </Dropdown.Title>
                    );
                }

                case 'item': {
                    const { node, name, ...rest } = m;
                    return (
                        <Dropdown.Item {...rest} key={node + name + index}>
                            {name}
                        </Dropdown.Item>
                    );
                }

                case 'divider': {
                    return <Dropdown.Divider key={m.node + index} />;
                }

                default:
                    return null;
            }
        });
        return <Dropdown.Menu>{content}</Dropdown.Menu>;
    }

    renderPopCard() {
        const { render, contentClassName, style, showTick, prefixCls } = this.props;
        const className = classnames(prefixCls, contentClassName);
        const { level = 0 } = this.context;
        const contextValue = { showTick, level: level + 1 };
        return (
            <DropdownContext.Provider value={contextValue}>
                <div className={className} style={style}>
                    <div className={`${prefixCls}-content`}>{render}</div>
                </div>
            </DropdownContext.Provider>
        );
    }

    render() {
        const {
            children,
            position,
            trigger,
            onVisibleChange,
            zIndex,
            className,
            motion,
            margin,
            style,
            prefixCls,
            ...attr
        } = this.props;
        let { spacing } = this.props;
        const { level } = this.context;
        const { popVisible } = this.state;
        const pop = this.renderContent();

        if (level > 0) {
            spacing = typeof spacing === 'number' ? spacing : numbers.NESTED_SPACING;
        } else if (spacing === null || typeof spacing === 'undefined') {
            spacing = numbers.SPACING;
        }

        return (
            <Tooltip
                zIndex={zIndex}
                motion={motion}
                margin={margin}
                content={pop}
                className={className}
                prefixCls={prefixCls}
                spacing={spacing}
                position={position}
                trigger={trigger}
                onVisibleChange={this.handleVisibleChange}
                showArrow={false}
                returnFocusOnClose={true}
                ref={this.tooltipRef}
                {...attr}
            >
                {React.isValidElement(children) ?
                    React.cloneElement(children, {
                        //@ts-ignore
                        className: classnames(get(children, 'props.className'), {
                            [`${prefixCls}-showing`]: popVisible,
                        }),
                        'aria-haspopup': true,
                        'aria-expanded': popVisible,
                        onKeyDown: (e: React.KeyboardEvent) => {
                            this.foundation.handleKeyDown(e);
                            const childrenKeyDown: (e: React.KeyboardEvent) => void = get(children, 'props.onKeyDown');
                            childrenKeyDown && childrenKeyDown(e);
                        }
                    }) :
                    children}
            </Tooltip>
        );
    }
}
export default Dropdown;
