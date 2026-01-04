import React from 'react';
import cls from 'classnames';
import propTypes from 'prop-types';
import { cssClasses, strings } from '@douyinfe/semi-foundation/breadcrumb/constants';
import BreadcrumbFoundation, { BreadcrumbAdapter } from '@douyinfe/semi-foundation/breadcrumb/foundation';
import warning from '@douyinfe/semi-foundation/utils/warning';
import { isFunction } from 'lodash';
import '@douyinfe/semi-foundation/breadcrumb/breadcrumb.scss';
import { noop } from '@douyinfe/semi-foundation/utils/function';
import BaseComponent, { BaseProps } from '../_base/baseComponent';
import Popover from '../popover';
import BreadcrumbItem, { RouteProps, BreadcrumbItemInfo } from './item';
import BreadContext, { BreadContextType } from './bread-context';
import { TooltipProps } from '../tooltip';
import { IconMore } from '@douyinfe/semi-icons';

const clsPrefix = cssClasses.PREFIX;

export type { RouteProps, BreadcrumbItemProps, BreadcrumbItemInfo } from './item';
export interface showToolTipProps {
    width?: string | number;
    ellipsisPos?: 'end' | 'middle';
    opts?: TooltipProps
}

export type MoreType = 'default' | 'popover';

export interface BreadcrumbProps extends BaseProps {
    routes?: Array<RouteProps | string>;
    onClick?: (route: RouteProps, event: React.MouseEvent) => void;
    separator?: React.ReactNode;
    compact?: boolean;
    style?: React.CSSProperties;
    renderItem?: (route: RouteProps) => React.ReactNode;
    className?: string;
    showTooltip?: boolean | showToolTipProps;
    maxItemCount?: number;
    autoCollapse?: boolean;
    /* Customize the contents of the ellipsis area */
    renderMore?: (restItem: Array<React.ReactNode>) => React.ReactNode;
    /* Style type for ellipsis area */
    moreType?: MoreType;
    'aria-label'?: React.AriaAttributes['aria-label']
    activeIndex?: number
}

interface BreadcrumbState {
    isCollapsed: boolean
}

class Breadcrumb extends BaseComponent<BreadcrumbProps, BreadcrumbState> {
    static contextType: React.Context<BreadContextType> = BreadContext;

    static Item: typeof BreadcrumbItem = BreadcrumbItem;

    static propTypes = {
        activeIndex: propTypes.number,
        routes: propTypes.array,
        onClick: propTypes.func,
        separator: propTypes.node,
        compact: propTypes.bool,
        children: propTypes.node,
        style: propTypes.object,
        renderItem: propTypes.func,
        showTooltip: propTypes.oneOfType([
            propTypes.shape({
                width: propTypes.oneOfType([propTypes.string, propTypes.number]),
                ellipsisPos: propTypes.oneOf(['end', 'middle']),
                opts: propTypes.object,
            }),
            propTypes.bool,
        ]),
        className: propTypes.string,
        autoCollapse: propTypes.bool,
        maxItemCount: propTypes.number,

        /* Customize the contents of the ellipsis area */
        renderMore: propTypes.func,

        /* Type of ellipsis area */
        moreType: propTypes.oneOf(strings.MORE_TYPE),
        'aria-label': propTypes.string,
    };
    static defaultProps = {
        routes: [] as [],
        onClick: noop,
        renderItem: undefined as undefined,
        separator: '/',
        compact: true,
        showTooltip: {
            width: 150,
            ellipsisPos: 'end',
        },
        autoCollapse: true,
        moreType: 'default',
        maxItemCount: 4,
        'aria-label': 'Breadcrumb'
    };

    constructor(props: BreadcrumbProps) {
        super(props);
        this.foundation = new BreadcrumbFoundation(this.adapter);
        this.state = {
            isCollapsed: true,
        };
        this.onClick = this.onClick.bind(this);
    }

    get adapter(): BreadcrumbAdapter<BreadcrumbProps, BreadcrumbState> {
        return {
            ...super.adapter,
            notifyClick: (...args) => {
                this.props.onClick(...args);
            },
            expandCollapsed: () =>
                this.setState({
                    isCollapsed: false,
                }),
        };
    }

    componentDidMount() {
        this.foundation.init();
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    renderPopoverMore(restItem: Array<React.ReactNode>) {
        const { separator } = this.props;
        const content = (
            <>
                {
                    restItem.map((item: React.ReactNode, idx: number) => (
                        <React.Fragment key={`restItem-${idx}`}>
                            {item}
                            {idx !== restItem.length - 1 &&
                                (
                                    <span className={`${clsPrefix}-restItem`}>
                                        {separator}
                                    </span>
                                )
                            }
                        </React.Fragment>
                    ))
                }
            </>
        );
        return (
            <Popover
                content={content}
                style={{
                    padding: 12,
                }}
                showArrow
            >
                <IconMore />
            </Popover>
        );
    }

    handleCollapse = (template: Array<React.ReactNode>, itemsLen: number) => {
        const { maxItemCount, renderMore, moreType } = this.props;
        const hasRenderMore = isFunction(renderMore);
        const restItem = template.slice(1, itemsLen - maxItemCount + 1);
        const spread = (
            <span className={`${clsPrefix}-collapse`} key={`more-${itemsLen}`}>
                <span className={`${clsPrefix}-item-wrap`}>
                    <span
                        role="button"
                        tabIndex={0}
                        aria-label="Expand breadcrumb items"
                        className={`${clsPrefix}-item ${clsPrefix}-item-more`}
                        onClick={item => this.foundation.handleExpand(item)}
                        onKeyPress={e => this.foundation.handleExpandEnterPress(e)}
                    >
                        {hasRenderMore && renderMore(restItem)}
                        {!hasRenderMore && moreType === 'default' && <IconMore />}
                        {!hasRenderMore && moreType === 'popover' && this.renderPopoverMore(restItem)}
                    </span>
                    <span className={`${clsPrefix}-separator`} x-semi-prop="separator">
                        {this.props.separator}
                    </span>
                </span>
            </span>
        );
        template.splice(1, itemsLen - maxItemCount, spread);
        return template;
    };

    renderRouteItems = (items: Array<RouteProps>, shouldCollapse: boolean, moreTypeIsPopover: boolean) => {
        const { renderItem, renderMore, maxItemCount } = this.props;
        const restItemLength = items.length - maxItemCount;
        const hasRenderMore = isFunction(renderMore);
        const template = (
            items.map((route, idx: number) => {
                const key = route._origin.key || `item-${route.name || route.path}-${idx}`;
                const inCollapseArea = idx > 0 && idx <= restItemLength;
                return (
                    <BreadcrumbItem
                        {...route}
                        key={key}
                        active={this.props.activeIndex !== undefined ? this.props.activeIndex===idx : idx === items.length - 1}
                        route={route._origin}
                        shouldRenderSeparator={ (idx !== items.length - 1) && !(shouldCollapse && (hasRenderMore || moreTypeIsPopover) && inCollapseArea)}
                    >
                        {renderItem ? renderItem(route._origin) : route.name}
                    </BreadcrumbItem>
                );
            })
        );
        return template;
    };

    renderList = (): Array<React.ReactNode> => {
        const {
            routes,
            children,
            autoCollapse,
            maxItemCount,
            renderMore,
            moreType
        } = this.props;
        const { isCollapsed } = this.state;
        const hasRoutes = routes && routes.length > 0;
        const items = hasRoutes ?
            this.foundation.genRoutes(routes) :
            React.Children.toArray(children);
        let template;
        const itemLength = items.length; // children length

        const restItemLength = itemLength - maxItemCount; // Omitted children items

        const shouldCollapse = items && autoCollapse && itemLength > maxItemCount && isCollapsed; // Whether the number of children exceeds, need to collapse

        const hasRenderMore = isFunction(renderMore); // Whether the user passes in the renderMore method
        const moreTypeIsPopover = moreType === 'popover';

        if (hasRoutes) {
            template = this.renderRouteItems(items, shouldCollapse, moreTypeIsPopover);
        } else {
            template = (
                items.map((item: any, idx: number) => {
                    const inCollapseArea = idx > 0 && idx <= restItemLength;
                    if (!item) {
                        return item;
                    }

                    warning(
                        item.type && !item.type.isBreadcrumbItem,
                        '[Semi Breadcrumb]: Only accepts Breadcrumb.Item as its children'
                    );

                    return React.cloneElement(item, {
                        key: `${idx}-item`,
                        active: this.props.activeIndex !== undefined ? this.props.activeIndex === idx : idx === items.length - 1,
                        shouldRenderSeparator: (idx !== items.length - 1) && (!(shouldCollapse && (hasRenderMore || moreTypeIsPopover) && inCollapseArea))
                    });
                })
            );
        }

        if (shouldCollapse) {
            return this.handleCollapse(template, items.length);
        }

        return template;
    };

    onClick = (info: BreadcrumbItemInfo, event: React.MouseEvent) => {
        this.foundation.handleClick(info, event);
    };

    render() {
        const breadcrumbs = this.renderList();
        const { compact, className, style, separator, showTooltip } = this.props;
        const sizeCls = cls(className,
            {
                [`${clsPrefix}-wrapper`]: true,
                [`${clsPrefix}-wrapper-compact`]: compact,
                [`${clsPrefix}-wrapper-loose`]: !compact
            }
        );
        return (
            <BreadContext.Provider
                value={{
                    onClick: this.onClick,
                    showTooltip,
                    compact,
                    separator,
                }}
            >
                <nav aria-label={this.props['aria-label']} className={sizeCls} style={style} {...this.getDataAttr(this.props)}>
                    {breadcrumbs}
                </nav>
            </BreadContext.Provider>
        );
    }
}

export default Breadcrumb;
