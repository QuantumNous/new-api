import React, { ReactNode, MouseEvent, forwardRef, LegacyRef, useCallback, useMemo } from 'react';
import cls from 'classnames';
import { cssClasses } from '@douyinfe/semi-foundation/tabs/constants';
import { IconClose } from '@douyinfe/semi-icons';
import { TabType, TabSize, TabPosition } from './interface';

export interface TabItemProps {
    tab?: ReactNode;
    icon?: ReactNode;
    size?: TabSize;
    type?: TabType;
    tabPosition?: TabPosition;
    selected?: boolean;
    closable?: boolean;
    disabled?: boolean;
    itemKey?: string;
    handleKeyDown?: (event: React.KeyboardEvent, itemKey: string, closable: boolean) => void;
    deleteTabItem?: (tabKey: string, event: MouseEvent<Element>) => void;
    onClick?: (itemKey: string, e: MouseEvent<Element>) => void 
}

const TabItem = (props: TabItemProps, ref: LegacyRef<HTMLDivElement>) => {
    const { 
        tab, 
        size, 
        type, 
        icon, 
        selected, 
        closable, 
        disabled, 
        itemKey, 
        deleteTabItem, 
        tabPosition, 
        handleKeyDown,
        onClick,
        ...restProps
    } = props;

    const closableIcon = useMemo(() => {
        return closable ?
            <IconClose 
                aria-label="Close" 
                role="button" 
                className={`${cssClasses.TABS_TAB}-icon-close`} 
                onClick={(e: MouseEvent<HTMLSpanElement>) => deleteTabItem(itemKey, e)} 
            /> : null;
    }, [type, closable, deleteTabItem, itemKey]);

    const renderIcon = useCallback(
        (icon: ReactNode) => (
            <span className={`${cssClasses.TABS_BAR}-icon`}>
                {icon}
            </span>
        ), []);

    const handleKeyDownInItem = useCallback(
        (event: React.KeyboardEvent) => {
            handleKeyDown && handleKeyDown(event, itemKey, closable);
        },
        [handleKeyDown, itemKey, closable],
    );

    const handleItemClick = useCallback(
        (e: MouseEvent) => {
            !disabled && onClick && onClick(itemKey, e);
        },
        [itemKey, disabled, onClick],
    );

    const panelIcon = icon ? renderIcon(icon) : null;
    const className = cls(
        cssClasses.TABS_TAB, 
        `${cssClasses.TABS_TAB}-${type}`,
        `${cssClasses.TABS_TAB}-${tabPosition}`,
        `${cssClasses.TABS_TAB}-single`,
        
        {
            [cssClasses.TABS_TAB_ACTIVE]: selected,
            [cssClasses.TABS_TAB_DISABLED]: disabled,
            [`${cssClasses.TABS_TAB}-small`]: size === 'small',
            [`${cssClasses.TABS_TAB}-medium`]: size === 'medium',
        }
    );
    
    return (
        <div
            role="tab"
            id={`semiTab${itemKey}`}
            data-tabkey={`semiTab${itemKey}`}
            aria-controls={`semiTabPanel${itemKey}`}
            aria-disabled={disabled ? 'true' : 'false'}
            aria-selected={selected ? 'true' : 'false'}
            tabIndex={selected ? 0 : -1}
            onKeyDown={handleKeyDownInItem}
            onClick={handleItemClick}
            className={className}
            {...restProps}
            ref={ref}
        >
            {panelIcon}
            {tab}
            {closableIcon}
        </div>
    );
};

// Why is forwardRef needed here？
// Because TabItem needs to be used in OverflowList （when tabs' type is collapsible), 
// OverflowList will pass ref to the outermost div DOM node of TabItem
const ForwardTabItem = forwardRef<HTMLDivElement, TabItemProps>(TabItem);

// @ts-ignore 
ForwardTabItem.elementType = 'Tabs.TabItem';

export default ForwardTabItem;
