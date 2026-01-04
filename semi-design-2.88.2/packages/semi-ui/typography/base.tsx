import React, { Component, CSSProperties } from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import { cssClasses, strings } from '@douyinfe/semi-foundation/typography/constants';
import Typography from './typography';
import Copyable from './copyable';
import { IconSize as Size } from '../icons/index';
import { isUndefined, omit, merge, isString, isNull, isFunction } from 'lodash';
import Tooltip from '../tooltip/index';
import Popover from '../popover/index';
import getRenderText from './util';
import warning from '@douyinfe/semi-foundation/utils/warning';
import isEnterPress from '@douyinfe/semi-foundation/utils/isEnterPress';
import LocaleConsumer from '../locale/localeConsumer';
import type { Locale } from '../locale/interface';
import type { Ellipsis, EllipsisPos, ShowTooltip, TypographyBaseSize, TypographyBaseType } from './interface';
import { CopyableConfig, LinkType } from './title';
import { BaseProps } from '../_base/baseComponent';
import { isSemiIcon, runAfterTicks } from '../_utils';
import SizeContext from './context';
import ResizeObserver, { ObserverProperty, ResizeEntry } from '../resizeObserver';

export interface BaseTypographyProps extends BaseProps {
    copyable?: CopyableConfig | boolean;
    delete?: boolean;
    disabled?: boolean;
    icon?: React.ReactNode;
    /**
     * ellipsis 用于设置截断相关参数.  
     * Ellipsis is used to set ellipsis related parameters.  
     * ellipsis 仅支持纯文本的截断，不支持 reactNode 等复杂类型，请确保 children 传入内容类型为 string.  
     * Ellipsis only supports ellipsis of plain text, and does not support complex types such as reactNode. 
     * Please ensure that the content type of children is string.  
     * Semi 截断有两种策略， CSS 截断和 JS 截断。  
     * Semi ellipsis has two strategies, CSS ellipsis and JS ellipsis.   
     *  - 当设置中间截断（pos='middle')、可展开（expandable)、有后缀（suffix 非空）、可复制（copyable），启用 JS 截断策略  
     *  - When setting middle ellipsis (pos='middle')、expandable、suffix is not empty string、copyable,
     * the JS ellipsis strategy is enabled
     *  - 非以上场景，启用 CSS 截断策略  
     *  - Otherwise, enable the CSS ellipsis strategy  
     *   
     * 通常来说 CSS 截断的性能优于 JS 截断。在 children 不变， 容器尺寸不变的情况下，CSS 截断只涉及 1-2 次计算，js 截断基于二分法，可能涉及多次计算。  
     * In general CSS ellipsis performs better than JS ellipsis. when the children and container size remain unchanged, 
     * CSS ellipsis only involves 1-2 calculations, while JS ellipsis is based on dichotomy and may require multiple calculations.  
     * 同时使用大量带有截断功能的 Typography 需注意性能消耗，如在 Table 中，可通过设置合理的页容量进行分页减少性能损耗  
     * Pay attention to performance consumption when using a large number of Typography with ellipsis. For example, in Table, 
     * you can reduce performance loss by setting a reasonable pageSize for paging
     */
    ellipsis?: Ellipsis | boolean;
    mark?: boolean;
    underline?: boolean;
    link?: LinkType;
    strong?: boolean;
    type?: TypographyBaseType;
    size?: TypographyBaseSize;
    style?: React.CSSProperties;
    className?: string;
    code?: boolean;
    children?: React.ReactNode;
    component?: React.ElementType;
    spacing?: string;
    heading?: string;
    weight?: string | number
}

interface BaseTypographyState {
    editable: boolean;
    copied: boolean;
    isOverflowed: boolean;
    ellipsisContent: React.ReactNode;
    expanded: boolean;
    isTruncated: boolean;
    prevChildren: React.ReactNode
}

const prefixCls = cssClasses.PREFIX;
const ELLIPSIS_STR = '...';

const wrapperDecorations = (props: BaseTypographyProps, content: React.ReactNode) => {
    const { mark, code, underline, strong, link, disabled } = props;
    let wrapped = content;
    const wrap = (isNeeded: boolean | LinkType, tag: string) => {
        let wrapProps = {};
        if (!isNeeded) {
            return;
        }
        if (typeof isNeeded === 'object') {
            wrapProps = { ...isNeeded };
        }
        wrapped = React.createElement(tag, wrapProps, wrapped);
    };
    wrap(mark, 'mark');
    wrap(code, 'code');
    wrap(underline && !link, 'u');
    wrap(strong, 'strong');
    wrap(props.delete, 'del');
    wrap(link, disabled ? 'span' : 'a');
    return wrapped;
};

export default class Base extends Component<BaseTypographyProps, BaseTypographyState> {
    static propTypes = {
        children: PropTypes.node,
        copyable: PropTypes.oneOfType([
            PropTypes.shape({
                text: PropTypes.string,
                onCopy: PropTypes.func,
                successTip: PropTypes.node,
                copyTip: PropTypes.node,
            }),
            PropTypes.bool,
        ]),
        delete: PropTypes.bool,
        disabled: PropTypes.bool,
        // editable: PropTypes.bool,
        ellipsis: PropTypes.oneOfType([
            PropTypes.shape({
                rows: PropTypes.number,
                expandable: PropTypes.bool,
                expandText: PropTypes.string,
                onExpand: PropTypes.func,
                suffix: PropTypes.string,
                showTooltip: PropTypes.oneOfType([
                    PropTypes.shape({
                        type: PropTypes.string,
                        opts: PropTypes.object,
                    }),
                    PropTypes.bool,
                ]),
                collapsible: PropTypes.bool,
                collapseText: PropTypes.string,
                pos: PropTypes.oneOf(['end', 'middle']),
            }),
            PropTypes.bool,
        ]),
        mark: PropTypes.bool,
        underline: PropTypes.bool,
        link: PropTypes.oneOfType([PropTypes.object, PropTypes.bool]),
        spacing: PropTypes.oneOf(strings.SPACING),
        strong: PropTypes.bool,
        size: PropTypes.oneOf(strings.SIZE),
        type: PropTypes.oneOf(strings.TYPE),
        style: PropTypes.object,
        className: PropTypes.string,
        icon: PropTypes.oneOfType([PropTypes.node, PropTypes.string]),
        heading: PropTypes.string,
        component: PropTypes.string,
    };

    static defaultProps = {
        children: null as React.ReactNode,
        copyable: false,
        delete: false,
        disabled: false,
        // editable: false,
        ellipsis: false,
        icon: '',
        mark: false,
        underline: false,
        strong: false,
        link: false,
        type: 'primary',
        spacing: 'normal',
        size: 'normal',
        style: {},
        className: '',
    };

    static contextType = SizeContext;

    context: TypographyBaseSize;
    wrapperRef: React.RefObject<any>;
    expandRef: React.RefObject<any>;
    copyRef: React.RefObject<any>;
    rafId: ReturnType<typeof requestAnimationFrame>;
    expandStr: string;
    collapseStr: string;
    observerTakingEffect: boolean = false

    constructor(props: BaseTypographyProps) {
        super(props);
        this.state = {
            editable: false,
            copied: false,
            // ellipsis
            // if text is overflow in container
            isOverflowed: false,
            ellipsisContent: props.children,
            expanded: false,
            // if text is truncated with js
            isTruncated: false,
            prevChildren: null,
        };
        this.wrapperRef = React.createRef();
        this.expandRef = React.createRef();
        this.copyRef = React.createRef();
    }

    componentDidMount() {
        if (this.props.ellipsis) {
            // runAfterTicks: make sure start observer on the next tick
            this.onResize().then(() => runAfterTicks(() => this.observerTakingEffect = true, 1));
        }
    }

    static getDerivedStateFromProps(props: BaseTypographyProps, prevState: BaseTypographyState) {
        const { prevChildren } = prevState;
        const newState: Partial<BaseTypographyState> = {};
        newState.prevChildren = props.children;

        if (props.ellipsis && prevChildren !== props.children) {
            // reset ellipsis state if children update
            newState.isOverflowed = false;
            newState.ellipsisContent = props.children;
            newState.expanded = false;
            newState.isTruncated = true;
        }
        return newState;
    }

    componentDidUpdate(prevProps: BaseTypographyProps) {
        // Render was based on outdated refs and needs to be rerun
        if (this.props.children !== prevProps.children) {
            this.forceUpdate();
            if (this.props.ellipsis) {
                this.onResize();
            }
        }
    }

    componentWillUnmount() {
        if (this.rafId) {
            window.cancelAnimationFrame(this.rafId);
        }
    }

    onResize = async (entries?: ResizeEntry[]) => {
        if (this.rafId) {
            window.cancelAnimationFrame(this.rafId);
        }
        return new Promise<void>(resolve => {
            this.rafId = window.requestAnimationFrame(async () => {
                await this.getEllipsisState();
                resolve();
            });
        });
    };

    // if it needs to use js overflowed:
    // 1. text is expandable 2. expandText need to be shown  3. has extra operation 4. text need to ellipse from mid
    canUseCSSEllipsis = () => {
        const { copyable } = this.props;
        const { expandable, expandText, pos, suffix } = this.getEllipsisOpt();
        return !expandable && isUndefined(expandText) && !copyable && pos === 'end' && !suffix.length;
    };

    /**
     * whether truncated
     *  rows < = 1 if there is overflow content, return true
     *  rows > 1 if there is overflow height, return true
     * @param {Number} rows
     * @returns {Boolean}
     */
    shouldTruncated = (rows: number) => {
        if (!rows || rows < 1) {
            return false;
        }
        const updateOverflow =
            rows <= 1 ?
                this.compareSingleRow() :
                this.wrapperRef.current.scrollHeight > this.wrapperRef.current.offsetHeight;
        return updateOverflow;
    };

    /**
     * 通过将 content 给到 Range 对象，借助 Range 的 getBoundingClientRect 拿到 content 的准确 width
     * 不受 css ellipsis 与否的影响
     * By giving the content to the Range object, get the exact width of the content with the help of Range's getBoundingClientRect
     * Not affected by css ellipsis or not
     * https://github.com/DouyinFE/semi-design/issues/1731
     */
    compareSingleRow = () => {
        if (!(document && document.createRange)) {
            return false;
        }
        const containerNode = this.wrapperRef.current;
        const containerWidth = containerNode.getBoundingClientRect().width;
        const childNodes = Array.from(containerNode.childNodes) as Node[];
        const range = document.createRange();
        const contentWidth = childNodes.reduce((acc: number, node: Node) => {
            range.selectNodeContents(node as Node);
            return acc + (range.getBoundingClientRect().width ?? 0);
        }, 0);
        range.detach();
        return contentWidth > containerWidth;
    }

    showTooltip = () => {
        const { isOverflowed, isTruncated, expanded } = this.state;
        const { showTooltip, expandable, expandText } = this.getEllipsisOpt();
        const canUseCSSEllipsis = this.canUseCSSEllipsis();
        // If the css is truncated, use isOverflowed to judge. If the css is truncated, use isTruncated to judge.
        const overflowed = !expanded && (canUseCSSEllipsis ? isOverflowed : isTruncated);
        const noExpandText = !expandable && isUndefined(expandText);
        const show = noExpandText && overflowed && showTooltip;
        if (!show) {
            return show;
        }
        const defaultOpts = {
            type: 'tooltip',
        };
        if (typeof showTooltip === 'object') {
            if (showTooltip.type && showTooltip.type.toLowerCase() === 'popover') {
                return merge(
                    {
                        opts: {
                            // style: { width: '240px' },
                            showArrow: true,
                        },
                    },
                    showTooltip,
                    {
                        opts: {
                            className: cls({
                                [`${prefixCls}-ellipsis-popover`]: true,
                                [showTooltip?.opts?.className]: Boolean(showTooltip?.opts?.className)
                            }),
                        }
                    }
                );
            }
            return { ...defaultOpts, ...showTooltip };
        }
        return defaultOpts;
    };

    onHover = () => {
        const canUseCSSEllipsis = this.canUseCSSEllipsis();
        if (canUseCSSEllipsis) {
            const { rows, suffix, pos } = this.getEllipsisOpt();
            const updateOverflow = this.shouldTruncated(rows);
            // isOverflowed needs to be updated to show tooltip when using css ellipsis
            this.setState({
                isOverflowed: updateOverflow,
                isTruncated: false
            });

            return undefined;
        }
    }

    getEllipsisState = async () => {
        const { rows, suffix, pos } = this.getEllipsisOpt();
        const { children, strong } = this.props;
        // wait until element mounted
        if (!this.wrapperRef || !this.wrapperRef.current) {
            await this.onResize();
            return;
        }
        const { expanded } = this.state;
        const canUseCSSEllipsis = this.canUseCSSEllipsis();
        if (canUseCSSEllipsis) {
            // const updateOverflow = this.shouldTruncated(rows);
            // // isOverflowed needs to be updated to show tooltip when using css ellipsis
            // this.setState({
            //     isOverflowed: updateOverflow,
            //     isTruncated: false
            // });

            return ;
        }

        // If children is null, css/js truncated flag isTruncate is false
        if (isNull(children)) {
            return new Promise<void>(resolve => {
                this.setState({
                    isTruncated: false,
                    isOverflowed: false
                }, resolve);
            }); 

        }

        // Currently only text truncation is supported, if there is non-text, 
        // both css truncation and js truncation should throw a warning
        warning(
            'children' in this.props && typeof children !== 'string',
            "[Semi Typography] Only children with pure text could be used with ellipsis at this moment."
        );

        if (!rows || rows < 0 || expanded) {
            return;
        }


        const extraNode = { expand: this.expandRef.current, copy: this.copyRef && this.copyRef.current };

        // Perform type conversion on children to prevent component crash due to non-string type of children
        // https://github.com/DouyinFE/semi-design/issues/2167
        const realChildren = Array.isArray(children) ? children.join('') : String(children);

        const content = getRenderText(
            this.wrapperRef.current,
            rows,
            realChildren,
            extraNode,
            ELLIPSIS_STR,
            suffix,
            pos,
            strong
        );
        return new Promise<void>(resolve => {
            this.setState({
                isOverflowed: false,
                ellipsisContent: content,
                isTruncated: realChildren !== content,
            }, resolve);
        });

    }

    /**
     * Triggered when the fold button is clicked to save the latest expanded state
     * @param {Event} e
     */
    toggleOverflow = (e: React.MouseEvent<HTMLAnchorElement>) => {
        const { onExpand, expandable, collapsible } = this.getEllipsisOpt();
        const { expanded } = this.state;
        onExpand && onExpand(!expanded, e);
        if ((expandable && !expanded) || (collapsible && expanded)) {
            this.setState({ expanded: !expanded });
        }
    };

    getEllipsisOpt = (): Ellipsis => {
        const { ellipsis } = this.props;
        if (!ellipsis) {
            return {};
        }
        const opt = {
            rows: 1,
            expandable: false,
            pos: 'end' as EllipsisPos,
            suffix: '',
            showTooltip: false,
            collapsible: false,
            expandText: (ellipsis as Ellipsis).expandable ? this.expandStr : undefined,
            collapseText: (ellipsis as Ellipsis).collapsible ? this.collapseStr : undefined,
            ...(typeof ellipsis === 'object' ? ellipsis : null),
        };
        return opt;
    };

    renderExpandable = () => {
        const { expanded, isTruncated } = this.state;
        if (!isTruncated) return null;

        const { expandText, expandable, collapseText, collapsible } = this.getEllipsisOpt();
        const noExpandText = !expandable && isUndefined(expandText);
        const noCollapseText = !collapsible && isUndefined(collapseText);
        let text;

        if (!expanded && !noExpandText) {
            text = expandText;
        } else if (expanded && !noCollapseText) {
            text = collapseText;
        }
        if (!noExpandText || !noCollapseText) {
            return (
                // TODO: replace `a` tag with `span` in next major version
                // NOTE: may have effect on style
                // eslint-disable-next-line jsx-a11y/anchor-is-valid
                <a
                    role="button"
                    tabIndex={0}
                    className={`${prefixCls}-ellipsis-expand`}
                    key="expand"
                    ref={this.expandRef}
                    aria-label={text}
                    onClick={this.toggleOverflow}
                    onKeyPress={e => isEnterPress(e) && this.toggleOverflow(e as any)}
                >
                    {text}
                </a>
            );
        }
        return null;
    };

    /**
     * 获取文本的缩略class和style
     *
     * 截断类型：
     *  - 当设置中间截断（pos='middle')、可展开（expandable)、有后缀（suffix 非空）、可复制（copyable），启用 JS 截断策略 
     *  - 非以上场景，启用 CSS 截断策略
     * 相关变量
     *  props:
     *      - ellipsis:
     *          - rows
     *          - expandable
     *          - pos
     *          - suffix
     *  state:
     *      - isOverflowed，文本是否处于overflow状态
     *      - expanded，文本是否处于折叠状态
     *      - isTruncated，文本是否被js截断
     *
     * Get the abbreviated class and style of the text
     *
     * Truncation type:
     *  -When setting middle ellipsis (pos='middle')、expandable、suffix is not empty、copyable, the JS ellipsis strategy is enabled
     *  -Otherwise, enable the CSS ellipsis strategy  
     * related variables
     *  props:
     *      -ellipsis:
     *          -rows
     *          -expandable
     *          -pos
     *          -suffix
     *  state:
     *      -isOverflowed, whether the text is in an overflow state
     *      -expanded, whether the text is in a collapsed state
     *      -isTruncated, whether the text is truncated by js
     * @returns {Object}
     */
    getEllipsisStyle = () => {
        const { ellipsis, component } = this.props;
        if (!ellipsis) {
            return {
                ellipsisCls: '',
                ellipsisStyle: {},
                // ellipsisAttr: {}
            };
        }
        const { rows } = this.getEllipsisOpt();
        const { expanded } = this.state;
        const useCSS = !expanded && this.canUseCSSEllipsis();
        const ellipsisCls = cls({
            [`${prefixCls}-ellipsis`]: true,
            [`${prefixCls}-ellipsis-single-line`]: rows === 1,
            [`${prefixCls}-ellipsis-multiple-line`]: rows > 1,
            // component === 'span', Text component, It should be externally displayed inline
            [`${prefixCls}-ellipsis-multiple-line-text`]: rows > 1 && component === 'span',
            [`${prefixCls}-ellipsis-overflow-ellipsis`]: rows === 1 && useCSS,
            // component === 'span', Text component, It should be externally displayed inline
            [`${prefixCls}-ellipsis-overflow-ellipsis-text`]: rows === 1 && useCSS && component === 'span',
        });
        const ellipsisStyle = useCSS && rows > 1 ? { WebkitLineClamp: rows } : {};
        return {
            ellipsisCls,
            ellipsisStyle,
        };
    };

    renderEllipsisText = (opt: Ellipsis) => {
        const { suffix } = opt;
        const { children } = this.props;
        const { isTruncated, expanded, ellipsisContent } = this.state;
        if (expanded || !isTruncated) {
            return (
                <span onMouseEnter={this.onHover}>
                    {children}
                    {suffix && suffix.length ? suffix : null}
                </span>
            );
        }
        return (
            <span onMouseEnter={this.onHover}>
                {ellipsisContent}
                {/* {ELLIPSIS_STR} */}
                {suffix}
            </span>
        );
    };

    renderOperations() {
        return (
            <>
                {this.renderExpandable()}
                {this.renderCopy()}
            </>
        );
    }

    renderCopy() {
        const { copyable, children } = this.props;
        if (!copyable) {
            return null;
        }
        // If it is configured in the content of copyable, the copied content will be the content in copyable
        const willCopyContent = (copyable as CopyableConfig)?.content ?? children;
        let copyContent: string;
        let hasObject = false;
        if (Array.isArray(willCopyContent)) {
            copyContent = '';
            willCopyContent.forEach(value => {
                if (typeof value === 'object') {
                    hasObject = true;
                }
                copyContent += String(value);
            });
        } else if (typeof willCopyContent !== 'object') {
            copyContent = String(willCopyContent);
        } else {
            hasObject = true;
            copyContent = String(willCopyContent);
        }

        warning(
            hasObject,
            'Content to be copied in Typography is a object, it will case a [object Object] mistake when copy to clipboard.'
        );
        const copyConfig = {
            content: copyContent,
            duration: 3,
            ...(typeof copyable === 'object' ? copyable : null),
        };
        return <Copyable {...copyConfig} forwardRef={this.copyRef}/>;
    }

    renderIcon() {
        const { icon, size } = this.props;
        const realSize = size === 'inherit' ? this.context : size;
        if (!icon) {
            return null;
        }
        const iconSize: Size = realSize === 'small' ? 'small' : 'default';
        return (
            <span className={`${prefixCls}-icon`} x-semi-prop="icon">
                {isSemiIcon(icon) ? React.cloneElement((icon as React.ReactElement<any>), { size: iconSize }) : icon}
            </span>
        );
    }

    renderContent() {
        const {
            component,
            children,
            className,
            type,
            spacing,
            disabled,
            style,
            ellipsis,
            icon,
            size,
            link,
            heading,
            weight,
            ...rest
        } = this.props;
        const textProps = omit(rest, [
            'strong',
            'editable',
            'mark',
            'copyable',
            'underline',
            'code',
            // 'link',
            'delete',
        ]);
        const realSize = size === 'inherit' ? this.context : size;
        const iconNode = this.renderIcon();
        const ellipsisOpt = this.getEllipsisOpt();
        const { ellipsisCls, ellipsisStyle } = this.getEllipsisStyle();
        let textNode = ellipsis ? this.renderEllipsisText(ellipsisOpt) : children;
        const linkCls = cls({
            [`${prefixCls}-link-text`]: link,
            [`${prefixCls}-link-underline`]: this.props.underline && link,
        });
        textNode = wrapperDecorations(
            this.props,
            <>
                {iconNode}
                {this.props.link ? <span className={linkCls}>{textNode}</span> : textNode}
            </>
        );
        const hTagReg = /^h[1-6]$/;
        const isHeader = isString(heading) && hTagReg.test(heading);
        const wrapperCls = cls(className, ellipsisCls, {
            // [`${prefixCls}-primary`]: !type || type === 'primary',
            [`${prefixCls}-${type}`]: type && !link,
            [`${prefixCls}-${realSize}`]: realSize,
            [`${prefixCls}-link`]: link,
            [`${prefixCls}-disabled`]: disabled,
            [`${prefixCls}-${spacing}`]: spacing,
            [`${prefixCls}-${heading}`]: isHeader,
            [`${prefixCls}-${heading}-weight-${weight}`]: isHeader && weight && isNaN(Number(weight)),
        });

        const textStyle: CSSProperties = {
            ...(
                isNaN(Number(weight)) ? {} : { fontWeight: weight }
            ),
            ...style
        };

        return (
            <Typography
                tooltipRef={this.wrapperRef}
                className={wrapperCls}
                style={{ ...textStyle, ...ellipsisStyle }}
                component={component}
                forwardRef={this.wrapperRef}
                {...textProps}
            >
                {textNode}
                {this.renderOperations()}
            </Typography>
        );
    }

    renderTipWrapper() {
        const { children } = this.props;
        const showTooltip = this.showTooltip();
        const content = this.renderContent();
        if (showTooltip) {
            const { type, opts, renderTooltip } = showTooltip as ShowTooltip;
            if (isFunction(renderTooltip)) {
                return renderTooltip(children, content);
            } else if (type.toLowerCase() === 'popover') {
                return (
                    <Popover content={children} position="top" {...opts}>
                        {content}
                    </Popover>
                );
            }
            return (
                <Tooltip content={children} position="top" {...opts}>
                    {content}
                </Tooltip>
            );
        } else {
            return content;
        }
    }

    render() {
        const { size } = this.props;
        const realSize = size === 'inherit' ? this.context : size;
        const content = (
            <SizeContext.Provider value={realSize}>
                <LocaleConsumer componentName="Typography">
                    {(locale: Locale['Typography']) => {
                        this.expandStr = locale.expand;
                        this.collapseStr = locale.collapse;
                        return this.renderTipWrapper();
                    }}
                </LocaleConsumer>
            </SizeContext.Provider>
        );
        if (this.props.ellipsis) {
            return (
                <ResizeObserver onResize={(...args) => {
                    if (this.observerTakingEffect) {
                        this.onResize(...args);
                    }
                }} observeParent observerProperty={ObserverProperty.Width}>
                    {content}
                </ResizeObserver>
            );
        }
        return content;
    }
}
