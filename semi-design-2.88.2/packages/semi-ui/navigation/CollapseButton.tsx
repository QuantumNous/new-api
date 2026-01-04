import React from 'react';
import { noop } from 'lodash';
import { IconSidebar } from '@douyinfe/semi-icons';
import Button from '../button';
import Tooltip from '../tooltip';
import { Locale } from '../locale/interface';

export interface CollapseButtonProps {
    prefixCls?: string;
    locale?: Locale['Navigation'];
    collapseText?(isCollapsed: boolean): React.ReactNode;
    isCollapsed?: boolean;
    onClick?(e: boolean): void
}

export default function CollapseButton({ prefixCls, locale, collapseText, isCollapsed, onClick = noop }: CollapseButtonProps) {
    const handleClick = () => {
        if (typeof onClick === 'function') {
            onClick(!isCollapsed);
        }
    };

    const btnProps = {
        icon: <IconSidebar />,
        type: 'tertiary',
        theme: 'borderless',
        onClick: handleClick,
    };

    let finalCollapseText: React.ReactNode = isCollapsed ? locale?.expandText : locale?.collapseText;

    if (typeof collapseText === 'function') {
        finalCollapseText = collapseText(isCollapsed);
    }

    return (
        <div className={`${prefixCls}-collapse-btn`}>
            {isCollapsed ? (
                <Tooltip content={finalCollapseText} position="right">
                    <span className={`${prefixCls}-collapse-wrapper`}>
                        <Button {...(btnProps as any)} />
                    </span>
                </Tooltip>
            ) : (
                <Button {...(btnProps as any)}>{finalCollapseText}</Button>
            )}
        </div>
    );
}
