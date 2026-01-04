import React, { Fragment } from 'react';
import cls from 'classnames';
import propTypes from 'prop-types';
import { cssClasses } from '@douyinfe/semi-foundation/breadcrumb/constants';
import BreadcrumbItemFoundation, { BreadcrumbItemAdapter, BreadcrumbItemInfo, Route } from '@douyinfe/semi-foundation/breadcrumb/itemFoundation';
import BaseComponent, { BaseProps } from '../_base/baseComponent';
import { noop } from '@douyinfe/semi-foundation/utils/function';
import BreadContext, { BreadContextType } from './bread-context';
import Typography, { EllipsisPos, ShowTooltip as ShowTooltipType } from '../typography';
import { merge, isUndefined, isNull } from 'lodash';

const clsPrefix = cssClasses.PREFIX;

export type { BreadcrumbItemInfo };

export interface RouteProps extends Route {
    icon?: React.ReactNode
}
export interface BreadcrumbItemProps extends BaseProps {
    onClick?: (item: RouteProps, e: React.MouseEvent) => void;
    icon?: React.ReactNode;
    href?: string;
    separator?: React.ReactNode;
    noLink?: boolean;
    active?: boolean;
    shouldRenderSeparator?: boolean;
    route?: RouteProps
}

type BreadcrumbItemState = Record<string, never>;

interface GetTooltipOptType {
    width: number;
    ellipsisPos: EllipsisPos;
    opts?: ShowTooltipType['opts']
}

export default class BreadcrumbItem extends BaseComponent<BreadcrumbItemProps, BreadcrumbItemState> {
    static isBreadcrumbItem = true;
    static contextType = BreadContext;

    static propTypes = {
        onClick: propTypes.func,
        route: propTypes.oneOfType([propTypes.object, propTypes.string]),
        name: propTypes.string,
        children: propTypes.node,
        active: propTypes.bool,
        shouldRenderSeparator: propTypes.bool,
        icon: propTypes.node,
        separator: propTypes.node,
        noLink: propTypes.bool,
    };

    static defaultProps = {
        onClick: noop,
        shouldRenderSeparator: true
    };

    context: BreadContextType;

    get adapter(): BreadcrumbItemAdapter<BreadcrumbItemProps, BreadcrumbItemState> {
        return {
            ...super.adapter,
            notifyClick: (...args) => {
                this.props.onClick(...args);
            },
            notifyParent: (...args) => {
                this.context.onClick(...args);
            },
        };
    }

    constructor(props: BreadcrumbItemProps) {
        super(props);
        this.foundation = new BreadcrumbItemFoundation(this.adapter);
    }

    componentDidMount() {
        this.foundation.init();
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    renderIcon = () => {
        const iconType = this.props.icon;
        const { compact } = this.context;
        const iconSize = compact ? 'small' : 'default';
        const className = `${clsPrefix}-item-icon`;
        if (React.isValidElement(iconType)) {
            //@ts-ignore
            return React.cloneElement(iconType, { className, size: iconSize });
        }
        return iconType;
    };

    getTooltipOpt = () => {
        const { showTooltip } = this.context;
        if (!showTooltip) {
            return {
                width: 150,
                ellipsisPos: 'end',
            };
        }
        const defaultOpts = {
            width: 150,
            ellipsisPos: 'end',
            opts: {
                autoAdjustOverflow: true,
                position: 'top',
            },
        };
        if (typeof showTooltip === 'object') {
            return merge(defaultOpts, showTooltip);
        }
        return defaultOpts;
    };

    getItemInfo = (): BreadcrumbItemInfo => {
        let itemInfo: BreadcrumbItemInfo = {};
        const { route, children, href } = this.props;
        const hasHref = !isUndefined(href) && !isNull(href);
        if (route) {
            itemInfo = route;
        } else {
            itemInfo.name = children;
            if (hasHref) {
                itemInfo.href = href;
            }
        }
        return itemInfo;
    };

    renderBreadItem = () => {
        const { children } = this.props;
        const { compact } = this.context;
        const showTooltip = this.getTooltipOpt();
        const icon = this.renderIcon();
        if (Boolean(children) && typeof children === 'string') {
            const { opts, ellipsisPos, width } = showTooltip as GetTooltipOptType;
            return (
                <Fragment>
                    {icon}
                    <span className={`${clsPrefix}-item-title`}>
                        <Typography.Text
                            ellipsis={{
                                showTooltip: opts ? { opts } : false,
                                pos: ellipsisPos,
                            }}
                            // icon={this.renderIcon(icon)}
                            style={{ maxWidth: width }}
                            size={compact ? 'small' : 'normal'}
                        >
                            {children}
                        </Typography.Text>
                    </span>
                </Fragment>
            );
        }

        return (
            <Fragment>
                {icon}
                {children ? (
                    <span className={`${clsPrefix}-item-title ${clsPrefix}-item-title-inline`}>{children}</span>
                ) : null}
            </Fragment>
        );
    };

    renderItem = () => {
        const { href, active, noLink } = this.props;
        const hasHref = href !== null && typeof href !== 'undefined';
        const itemCls = cls({
            [`${clsPrefix}-item`]: true,
            [`${clsPrefix}-item-active`]: active,
            [`${clsPrefix}-item-link`]: !noLink,
        });
        const itemInner = this.renderBreadItem();
        const tag = active || !hasHref ? 'span' : 'a';
        const itemInfo = this.getItemInfo();
        return React.createElement(
            tag,
            {
                className: itemCls,
                onClick: e => this.foundation.handleClick(itemInfo, e),
                href,
            },
            itemInner
        );
    };

    render() {
        const {
            active,
            shouldRenderSeparator
            // children,
        } = this.props;
        const pageLabel = active ? { 'aria-current': 'page' as const } : {};
        const item = this.renderItem();
        const separator = this.props.separator || <span className={`${clsPrefix}-separator`}>{this.context.separator}</span>;
        const wrapperCLs = cls({
            [`${clsPrefix}-item-wrap`]: true,
            // [`${clsPrefix}-item-wrap-iconOnly`]: !!children && this.props.icon,
        });
        return (
            <span className={wrapperCLs} {...pageLabel} {...this.getDataAttr(this.props)}>
                {item}
                {shouldRenderSeparator && separator}
            </span>
        );
    }
}
