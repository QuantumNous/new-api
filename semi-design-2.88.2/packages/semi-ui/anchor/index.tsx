import React, { ReactNode } from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import { cssClasses, strings } from '@douyinfe/semi-foundation/anchor/constants';
import AnchorFoundation, { AnchorAdapter } from '@douyinfe/semi-foundation/anchor/foundation';
import BaseComponent from '../_base/baseComponent';
import Link from './link';
import AnchorContext from './anchor-context';
import '@douyinfe/semi-foundation/anchor/anchor.scss';
import { noop, debounce, throttle } from 'lodash';
import getUuid from '@douyinfe/semi-foundation/utils/uuid';
import { ArrayElement } from '../_base/base';
import ConfigContext, { ContextValue } from '../configProvider/context';
import { ShowTooltip } from '../typography/interface';

const prefixCls = cssClasses.PREFIX;

export type { LinkProps } from './link';

export interface AnchorProps {
    autoCollapse?: boolean;
    className?: string;
    children?: ReactNode;
    defaultAnchor?: string;
    getContainer?: () => HTMLElement | Window;
    maxHeight?: string | number;
    maxWidth?: string | number;
    offsetTop?: number;
    position?: ArrayElement<typeof strings.POSITION_SET>;
    railTheme?: ArrayElement<typeof strings.SLIDE_COLOR>;
    scrollMotion?: boolean;
    showTooltip?: boolean | ShowTooltip;
    size?: ArrayElement<typeof strings.SIZE>;
    style?: React.CSSProperties;
    targetOffset?: number;
    onChange?: (currentLink: string, previousLink: string) => void;
    onClick?: (e: React.MouseEvent<HTMLElement>, currentLink: string) => void;
    'aria-label'?: React.AriaAttributes['aria-label']
}

export interface AnchorState {
    activeLink: string;
    links: string[];
    clickLink: boolean;
    scrollHeight: string;
    slideBarTop: string
}

class Anchor extends BaseComponent<AnchorProps, AnchorState> {
    static contextType = ConfigContext;
    static Link = Link;
    static PropTypes = {
        size: PropTypes.oneOf(strings.SIZE),
        railTheme: PropTypes.oneOf(strings.SLIDE_COLOR),
        className: PropTypes.string,
        style: PropTypes.object,
        scrollMotion: PropTypes.bool,
        autoCollapse: PropTypes.bool,
        offsetTop: PropTypes.number,
        targetOffset: PropTypes.number,
        showTooltip: PropTypes.bool,
        position: PropTypes.oneOf(strings.POSITION_SET),
        maxWidth: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        maxHeight: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        getContainer: PropTypes.func,
        onChange: PropTypes.func,
        onClick: PropTypes.func,
        defaultAnchor: PropTypes.string,
        'aria-label': PropTypes.string,
    };

    static defaultProps = {
        size: 'default',
        railTheme: 'primary',
        className: '',
        scrollMotion: false,
        autoCollapse: false,
        offsetTop: 0,
        targetOffset: 0,
        showTooltip: false,
        maxWidth: strings.MAX_WIDTH,
        maxHeight: strings.MAX_HEIGHT,
        getContainer: noop,
        onChange: noop,
        onClick: noop,
        defaultAnchor: '',
    };

    foundation: AnchorFoundation;
    anchorID: string;
    scrollContainer: HTMLElement | Window;
    childMap: Record<string, Set<string>>;
    handler: () => void;
    clickHandler: () => void;
    context: ContextValue;

    constructor(props: AnchorProps) {
        super(props);
        this.state = {
            activeLink: '',
            links: [],
            clickLink: false,
            scrollHeight: '100%',
            slideBarTop: '0',
        };

        this.foundation = new AnchorFoundation(this.adapter);
        this.childMap = {};
    }

    get adapter(): AnchorAdapter<AnchorProps, AnchorState> {
        return {
            ...super.adapter,
            addLink: value => {
                this.setState(prevState => ({ links: [...prevState.links, value] }));
            },
            removeLink: link => {
                this.setState(prevState => {
                    const links = prevState.links.slice();
                    const index = links.indexOf(link);
                    if (index !== -1) {
                        links.splice(index, 1);
                        return { links };
                    }
                    return undefined;
                });
            },
            setChildMap: value => {
                this.childMap = value;
            },
            setScrollHeight: height => {
                this.setState({ scrollHeight: height });
            },
            setSlideBarTop: height => {
                this.setState({ slideBarTop: `${height}px` });
            },
            setClickLink: value => {
                this.setState({ clickLink: value });
            },
            setActiveLink: (link, cb) => {
                this.setState({ activeLink: link }, () => {
                    cb();
                });
            },
            setClickLinkWithCallBack: (value, link, cb) => {
                this.setState({ clickLink: value }, () => {
                    cb(link);
                });
            },
            getContainer: () => {
                const { getContainer } = this.props;
                const container = getContainer();
                return container ? container : window;
            },
            getContainerBoundingTop: () => {
                const container = this.adapter.getContainer();
                if ('getBoundingClientRect' in container) {
                    return container.getBoundingClientRect().top;
                }
                return 0;
            },
            getLinksBoundingTop: () => {
                const { links } = this.state;
                const { offsetTop } = this.props;
                const containerTop = this.adapter.getContainerBoundingTop();
                const elTop = links.map(link => {
                    let node = null;
                    try {
                        // Get links from containers
                        node = document.querySelector(link);
                    } catch (e) {}
                    return (node && node.getBoundingClientRect().top - containerTop - offsetTop) || -Infinity;
                });
                return elTop;
            },
            getAnchorNode: selector => {
                const selectors = `#${this.anchorID} ${selector}`;
                return document.querySelector(selectors);
            },
            getContentNode: selector => document.querySelector(selector),
            notifyChange: (currentLink, previousLink) => this.props.onChange(currentLink, previousLink),
            notifyClick: (e, link) => this.props.onClick(e, link),
            canSmoothScroll: () => 'scrollBehavior' in document.body.style,
        };
    }

    addLink = (link: string) => {
        this.foundation.addLink(link);
    };

    removeLink = (link: string) => {
        this.foundation.removeLink(link);
    };

    handleScroll = () => {
        this.foundation.handleScroll();
    };

    handleClick = (e: React.MouseEvent<HTMLElement>, link: string) => {
        this.foundation.handleClick(e, link);
    };

    // Set click to false after scrolling
    handleClickLink = () => {
        this.foundation.handleClickLink();
    };

    setChildMap = () => {
        this.foundation.setChildMap();
    };

    setScrollHeight = () => {
        this.foundation.setScrollHeight();
    };

    updateScrollHeight = (prevState: AnchorState, state: AnchorState) => {
        this.foundation.updateScrollHeight(prevState, state);
    };

    updateChildMap = (prevState: AnchorState, state: AnchorState) => {
        this.foundation.updateChildMap(prevState, state);
    };

    renderChildren = () => {
        const loop = (children, level = 1) => {
            return React.Children.map(children, child => {
                if (React.isValidElement(child)) {
                    const childProps = {
                        direction: this.context.direction,
                        level,
                        children: [],
                    };
                    const { children } = child.props as any;
                    const hasChildren = children && React.Children.count(children) > 0;
                    if (hasChildren) {
                        childProps.children = loop(children, level + 1);
                    }
                    return React.cloneElement(child, childProps);
                }
                return null;
            });
        };
        return loop(this.props.children);
    };

    componentDidMount() {
        const { defaultAnchor = '' } = this.props;
        this.anchorID = getUuid('semi-anchor').replace('.', '');
        this.scrollContainer = this.adapter.getContainer();
        this.handler = throttle(this.handleScroll, 100);
        this.clickHandler = debounce(this.handleClickLink, 100);
        this.scrollContainer.addEventListener('scroll', this.handler);
        this.scrollContainer.addEventListener('scroll', this.clickHandler);
        this.setScrollHeight();
        this.setChildMap();
        Boolean(defaultAnchor) && this.foundation.handleClick(null, defaultAnchor, false);
    }

    componentDidUpdate(prevProps: AnchorProps, prevState: AnchorState) {
        this.updateScrollHeight(prevState, this.state);
        this.updateChildMap(prevState, this.state);
    }

    componentWillUnmount() {
        this.scrollContainer.removeEventListener('scroll', this.handler);
        this.scrollContainer.removeEventListener('scroll', this.clickHandler);
    }

    render() {
        const {
            size,
            railTheme,
            style,
            className,
            children,
            maxWidth,
            maxHeight,
            showTooltip,
            position,
            autoCollapse,
        } = this.props;
        const ariaLabel = this.props['aria-label'];
        const { activeLink, scrollHeight, slideBarTop } = this.state;
        const wrapperCls = cls(prefixCls, className, {
            [`${prefixCls}-size-${size}`]: size,
        });
        const slideCls = cls(`${prefixCls}-slide`, `${prefixCls}-slide-${railTheme}`);
        const slideBarCls = cls(`${prefixCls}-slide-bar`, {
            [`${prefixCls}-slide-bar-${size}`]: size,
            [`${prefixCls}-slide-bar-${railTheme}`]: railTheme,
            [`${prefixCls}-slide-bar-active`]: activeLink,
        });
        const anchorWrapper = `${prefixCls}-link-wrapper`;
        const wrapperStyle = {
            ...style,
            maxWidth,
            maxHeight,
        };

        return (
            <AnchorContext.Provider
                value={{
                    activeLink,
                    showTooltip,
                    position,
                    childMap: this.childMap,
                    autoCollapse,
                    size,
                    onClick: (e, link) => this.handleClick(e, link),
                    addLink: this.addLink,
                    removeLink: this.removeLink,
                }}
            >
                <div
                    role="navigation"
                    aria-label={ariaLabel || 'Side navigation'}
                    className={wrapperCls}
                    style={wrapperStyle}
                    id={this.anchorID}
                    {...this.getDataAttr(this.props)}
                >
                    <div aria-hidden className={slideCls} style={{ height: scrollHeight }}>
                        <span className={slideBarCls} style={{ top: slideBarTop }} />
                    </div>
                    <div className={anchorWrapper} role="list">
                        {this.renderChildren()}
                    </div>
                </div>
            </AnchorContext.Provider>
        );
    }
}

export default Anchor;
