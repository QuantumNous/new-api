import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import cls from 'classnames';

import isNullOrUndefined from '@douyinfe/semi-foundation/utils/isNullOrUndefined';
import { cssClasses } from '@douyinfe/semi-foundation/navigation/constants';
import '@douyinfe/semi-foundation/navigation/navigation.scss';

import NavContext, { NavContextType } from './nav-context';
import { BaseProps } from '../_base/baseComponent';

export type Logo = React.ReactNode;

export interface NavHeaderProps extends BaseProps {
    link?: string;
    linkOptions?: React.AnchorHTMLAttributes<HTMLAnchorElement>;
    logo?: Logo;
    prefixCls?: string;
    text?: React.ReactNode
}

export default class NavHeader extends PureComponent<NavHeaderProps> {
    static contextType = NavContext;

    static propTypes = {
        prefixCls: PropTypes.string,
        logo: PropTypes.oneOfType([PropTypes.string, PropTypes.object, PropTypes.node]),
        text: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
        children: PropTypes.node,
        style: PropTypes.object,
        className: PropTypes.string,
        link: PropTypes.string,
        linkOptions: PropTypes.object,
    };

    static defaultProps = {
        prefixCls: cssClasses.PREFIX,
    };

    static elementType = "NavHeader";

    context: NavContextType;

    renderLogo(logo: React.ReactNode) {
        if (React.isValidElement(logo)) {
            return logo;
        }
        return null;
    }

    render() {
        const { children, style, className, logo, text, link, linkOptions, prefixCls } = this.props;

        const { isCollapsed } = this.context;

        const wrapCls = cls(className, `${cssClasses.PREFIX}-header`, {
            [`${cssClasses.PREFIX}-header-collapsed`]: isCollapsed,
        });

        let wrappedChildren = (
            <>
                {logo ? <i className={`${cssClasses.PREFIX}-header-logo`}>{this.renderLogo(logo)}</i> : null}
                {!isNullOrUndefined(text) && !isCollapsed ? (
                    <span className={`${cssClasses.PREFIX}-header-text`}>{text}</span>
                ) : null}
                {children}
            </>
        );

        if (typeof link === 'string') {
            wrappedChildren = (
                <a className={`${prefixCls}-header-link`} href={link} {...(linkOptions as any)}>
                    {wrappedChildren}
                </a>
            );
        }

        return (
            <div className={wrapCls} style={style}>
                {wrappedChildren}
            </div>
        );
    }
}
