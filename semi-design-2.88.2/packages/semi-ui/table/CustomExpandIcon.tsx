/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { noop } from 'lodash';

import { IconChevronRight, IconChevronDown, IconTreeTriangleDown, IconTreeTriangleRight } from '@douyinfe/semi-icons';
import { cssClasses } from '@douyinfe/semi-foundation/table/constants';
import isEnterPress from '@douyinfe/semi-foundation/utils/isEnterPress';

import CSSAnimation from "../_cssAnimation";

export interface CustomExpandIconProps {
    expanded?: boolean;
    componentType?: 'tree' | 'expand';
    onClick?: (nextExpand: boolean, e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseEnter?: (e: React.MouseEvent<HTMLSpanElement>) => void;
    onMouseLeave?: (e: React.MouseEvent<HTMLSpanElement>) => void;
    expandIcon?: ((expanded?: boolean) => React.ReactNode) | React.ReactNode;
    prefixCls?: string;
    motion?: boolean
}

/**
 * render expand icon
 */
export default function CustomExpandIcon(props: CustomExpandIconProps) {
    const {
        expanded,
        componentType = 'expand',
        onClick = noop,
        onMouseEnter = noop,
        onMouseLeave = noop,
        expandIcon,
        prefixCls = cssClasses.PREFIX,
        motion = true,
    } = props;

    let icon;

    if (React.isValidElement(expandIcon)) {
        icon = expandIcon;
    } else if (typeof expandIcon === 'function') {
        icon = expandIcon(expanded);
    } else if (componentType === 'tree') {
        icon = expanded && !motion ? <IconTreeTriangleDown size="small" /> : <IconTreeTriangleRight size="small" />;
    } else {
        icon = expanded && !motion ? <IconChevronDown /> : <IconChevronRight />;
    }

    const handleClick = useCallback(
        e => {
            if (typeof onClick === 'function') {
                onClick(!expanded, e);
            }
        },
        [expanded]
    );

    if (motion) {
        const originIcon = icon;
        icon = <CSSAnimation animationState={expanded ? "enter" : "leave"} startClassName={`${cssClasses.PREFIX}-expandedIcon-${expanded ? 'show' : "hide"}`}>
            {({ animationClassName }) => {
                return React.cloneElement(originIcon, { className: (originIcon.props.className || "") + " " + animationClassName });
            }}
        </CSSAnimation>;
    }

    return (
        <span
            role="button"
            aria-label="Expand this row"
            tabIndex={-1}
            onClick={handleClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            className={`${prefixCls}-expand-icon`}
            onKeyPress={e => isEnterPress(e) && handleClick(e as any)}
        >
            {icon}
        </span>
    );
}

