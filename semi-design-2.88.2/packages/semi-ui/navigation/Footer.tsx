import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import cls from 'classnames';

import { strings, cssClasses } from '@douyinfe/semi-foundation/navigation/constants';
import CollapseButton from './CollapseButton';
import '@douyinfe/semi-foundation/navigation/navigation.scss';
import { noop } from 'lodash';
import NavContext, { NavContextType } from './nav-context';
import { BaseProps } from '../_base/baseComponent';

export interface NavFooterProps extends BaseProps {
    collapseButton?: React.ReactNode;
    collapseText?: (collapsed?: boolean) => React.ReactNode;
    onClick?: (event: React.MouseEvent) => void
}

export default class NavFooter extends PureComponent<NavFooterProps> {
    static contextType = NavContext;

    static propTypes = {
        children: PropTypes.node,
        style: PropTypes.object,
        className: PropTypes.string,
        collapseButton: PropTypes.oneOfType([PropTypes.node, PropTypes.bool]),
        collapseText: PropTypes.func,
        onClick: PropTypes.func,
    };

    static defaultProps = {
        collapseButton: false,
        onClick: noop,
    };

    context: NavContextType;

    static elementType = "NavFooter";

    renderCollapseButton = () => {
        const { collapseButton, collapseText } = this.props;

        if (React.isValidElement(collapseButton)) {
            return collapseButton;
        }

        const { onCollapseChange, prefixCls, locale, isCollapsed } = this.context;

        return (
            <CollapseButton
                prefixCls={prefixCls}
                isCollapsed={isCollapsed}
                locale={locale}
                onClick={onCollapseChange}
                collapseText={collapseText}
            />
        );
    };

    render() {
        const { style, className, collapseButton, onClick } = this.props;
        let { children } = this.props;
        const { isCollapsed, mode } = this.context;

        if (!React.isValidElement(children) && collapseButton && mode !== strings.MODE_HORIZONTAL) {
            children = this.renderCollapseButton();
        }

        const wrapCls = cls(className, `${cssClasses.PREFIX}-footer`, {
            [`${cssClasses.PREFIX}-footer-collapsed`]: isCollapsed,
        });

        return (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
            <div className={wrapCls} style={style} onClick={onClick}>
                {children}
            </div>
        );
    }
}
