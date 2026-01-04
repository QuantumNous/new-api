import React from 'react';

import type { NavProps, ItemKey } from './index';
import { Locale } from '../locale/interface';
 
import type { DropdownProps } from '../dropdown';
export interface NavContextType {
    isCollapsed?: boolean;
    mode?: NavProps['mode'];
    openKeys?: ItemKey[];
    onCollapseChange?: NavProps['onCollapseChange'];
    prefixCls?: string;
    selectedKeys?: ItemKey[];
    toggleIconPosition?: string;
    selectedKeysIsControlled?: boolean;
    openKeysIsControlled?: boolean;
    limitIndent?: boolean;
    isInSubNav?: boolean;
    locale?: Locale['Navigation'];
    subNavMotion?: NavProps['subNavMotion'];
    subNavCloseDelay?: NavProps['subNavCloseDelay'];
    subNavOpenDelay?: NavProps['subNavOpenDelay'];
    canUpdateOpenKeys?: boolean;
    renderWrapper?: NavProps['renderWrapper'];
    getPopupContainer?: DropdownProps['getPopupContainer'];
    tooltipShowDelay?: number;
    tooltipHideDelay?: number
}

const NavContext = React.createContext<NavContextType>({
    isCollapsed: false,
    selectedKeys: [],
    openKeys: [],
});

export default NavContext;
