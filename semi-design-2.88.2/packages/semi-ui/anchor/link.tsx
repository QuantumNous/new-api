import React, { ReactNode } from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import BaseComponent from '../_base/baseComponent';
import { cssClasses } from '@douyinfe/semi-foundation/anchor/constants';
import LinkFoundation, { LinkAdapter } from '@douyinfe/semi-foundation/anchor/linkFoundation';
import AnchorContext, { AnchorContextType } from './anchor-context';
import Typography from '../typography/index';
import { isObject } from 'lodash';

const prefixCls = cssClasses.PREFIX;

export interface LinkProps {
    href?: string;
    title?: ReactNode;
    className?: string;
    children?: ReactNode;
    style?: React.CSSProperties;
    disabled?: boolean;
    level?: number;
    direction?: 'ltr' | 'rtl'
}

// eslint-disable-next-line @typescript-eslint/ban-types
export default class Link extends BaseComponent<LinkProps, {}> {
    static propTypes = {
        href: PropTypes.string,
        title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
        className: PropTypes.string,
        style: PropTypes.object,
    };

    static defaultProps = {
        href: '#',
        title: '',
        className: '',
    };

    static contextType = AnchorContext;

    foundation: LinkFoundation;

    context!: AnchorContextType;

    constructor(props: LinkProps) {
        super(props);
        this.foundation = new LinkFoundation(this.adapter);
        this.handleClick = this.handleClick.bind(this);
    }

    get adapter(): LinkAdapter {
        return {
            ...super.adapter,
            addLink: href => {
                this.context.addLink(href);
            },
            removeLink: href => {
                this.context.removeLink(href);
            },
        };
    }

    handleAddLink() {
        this.foundation.handleAddLink();
    }

    handleRemoveLink() {
        this.foundation.handleRemoveLink();
    }

    handleUpdateLink(href: string, prevHref: string) {
        this.foundation.handleUpdateLink(href, prevHref);
    }

    handleClick(e: React.KeyboardEvent | React.MouseEvent) {
        const { disabled, href } = this.props;
        const { onClick } = this.context;
        !disabled && onClick(e as any, href);
    }

    componentDidMount() {
        this.handleAddLink();
    }

    componentDidUpdate(prevProps: LinkProps) {
        const prevHref = prevProps.href;
        const { href } = this.props;
        this.handleUpdateLink(href, prevHref);
    }

    componentWillUnmount() {
        this.handleRemoveLink();
    }

    renderTitle = () => {
        const { href, title, disabled = false } = this.props;
        const { activeLink, showTooltip, position, size } = this.context;
        const active = activeLink === href;
        const linkTitleCls = cls(`${prefixCls}-link-tooltip`, {
            [`${prefixCls}-link-tooltip-small`]: size === 'small',
            [`${prefixCls}-link-tooltip-active`]: active,
            [`${prefixCls}-link-tooltip-disabled`]: disabled,
        });
        if (showTooltip) {
            const showTooltipObj = isObject(showTooltip) ? 
                Object.assign({ opts: {} }, showTooltip) : { opts: {} };
            // The position can be set through showTooltip, here it is compatible with the position API
            if (position) {
                showTooltipObj.opts['position'] = position;
            }
            return (
                <Typography.Text
                    size={size === 'default' ? 'normal' : 'small'}
                    ellipsis={{ showTooltip: showTooltipObj }}
                    type={'tertiary'}
                    className={linkTitleCls}
                >
                    {title}
                </Typography.Text>
            );
        } else {
            return title;
        }
    };

    renderChildren = () => {
        const { activeLink, childMap } = this.context;
        const { href, children } = this.props;
        if (!this.context.autoCollapse) {
            return <div role="list">{children}</div>;
        }
        return activeLink === href || (childMap[href] && childMap[href].has(activeLink)) ? (
            <div role="list">{children}</div>
        ) : null;
    };

    render() {
        const { href, className, style, disabled = false, title, level, direction } = this.props;
        const { activeLink, showTooltip } = this.context;
        const active = activeLink === href;
        const linkCls = cls(`${prefixCls}-link`, className);
        const linkTitleCls = cls(`${prefixCls}-link-title`, {
            [`${prefixCls}-link-title-active`]: active,
            [`${prefixCls}-link-title-disabled`]: disabled,
        });
        const paddingAttributeKey = direction === 'rtl' ? 'paddingRight' : 'paddingLeft';
        const ariaProps = {
            'aria-disabled': disabled,
            style: {
                [paddingAttributeKey]: 8 * level,
            },
        };
        if (active) {
            ariaProps['aria-details'] = 'active';
        }
        if (!showTooltip && typeof title === 'string') {
            ariaProps['title'] = title;
        }

        return (
            <div className={linkCls} style={style} role="listitem">
                <div
                    role="link"
                    tabIndex={0}
                    {...ariaProps}
                    className={linkTitleCls}
                    onClick={e => this.handleClick(e)}
                    onKeyPress={e => this.handleClick(e)}
                >
                    {this.renderTitle()}
                </div>
                {this.renderChildren()}
            </div>
        );
    }
}
