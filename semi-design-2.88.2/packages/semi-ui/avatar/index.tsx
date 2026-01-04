import React, { CSSProperties } from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import { cssClasses, strings } from '@douyinfe/semi-foundation/avatar/constants';
import AvatarFoundation, { AvatarAdapter } from '@douyinfe/semi-foundation/avatar/foundation';
import '@douyinfe/semi-foundation/avatar/avatar.scss';
import { noop } from '@douyinfe/semi-foundation/utils/function';
import BaseComponent from '../_base/baseComponent';
import { AvatarProps } from './interface';
import { handlePrevent } from '@douyinfe/semi-foundation/utils/a11y';
import { getDefaultPropsFromGlobalConfig } from "../_utils";
import TopSlotSvg from "./TopSlotSvg";


const sizeSet = strings.SIZE;
const shapeSet = strings.SHAPE;
const colorSet = strings.COLOR;
const prefixCls = cssClasses.PREFIX;

export * from './interface';

export interface AvatarState {
    isImgExist: boolean;
    hoverContent: React.ReactNode;
    focusVisible: boolean;
    scale: number
}

export default class Avatar extends BaseComponent<AvatarProps, AvatarState> {
    static __SemiComponentName__ = "Avatar";
    static defaultProps = getDefaultPropsFromGlobalConfig(Avatar.__SemiComponentName__, {
        size: 'medium',
        color: 'grey',
        shape: 'circle',
        gap: 3,
        onClick: noop,
        onMouseEnter: noop,
        onMouseLeave: noop,
    })

    static elementType: string;
    static propTypes = {
        children: PropTypes.node,
        color: PropTypes.oneOf(colorSet),
        shape: PropTypes.oneOf(shapeSet),
        size: PropTypes.oneOf(sizeSet),
        hoverMask: PropTypes.node,
        className: PropTypes.string,
        style: PropTypes.object,
        gap: PropTypes.number,
        imgAttr: PropTypes.object,
        src: PropTypes.string,
        srcSet: PropTypes.string,
        alt: PropTypes.string,
        onError: PropTypes.func,
        onClick: PropTypes.func,
        onMouseEnter: PropTypes.func,
        onMouseLeave: PropTypes.func,
        bottomSlot: PropTypes.shape({
            render: PropTypes.func,
            shape: PropTypes.oneOf(['circle', 'square']),
            text: PropTypes.node,
            bgColor: PropTypes.string,
            textColor: PropTypes.string,
            className: PropTypes.string,
            style: PropTypes.object,
        }),
        topSlot: PropTypes.shape({
            render: PropTypes.func,
            gradientStart: PropTypes.string,
            gradientEnd: PropTypes.string,
            text: PropTypes.node,
            textColor: PropTypes.string,
            className: PropTypes.string,
            style: PropTypes.object,
        }),
        border: PropTypes.oneOfType([
            PropTypes.shape({
                color: PropTypes.string,
                motion: PropTypes.bool,
            }),
            PropTypes.bool,
        ]),
        contentMotion: PropTypes.bool,
    };

    foundation!: AvatarFoundation;
    avatarRef: React.RefObject<HTMLElement | null>;

    constructor(props: AvatarProps) {
        super(props);
        this.state = {
            isImgExist: true,
            hoverContent: '',
            focusVisible: false,
            scale: 1,
        };
        this.onEnter = this.onEnter.bind(this);
        this.onLeave = this.onLeave.bind(this);
        this.handleError = this.handleError.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.getContent = this.getContent.bind(this);
        this.avatarRef = React.createRef();
    }

    get adapter(): AvatarAdapter<AvatarProps, AvatarState> {
        return {
            ...super.adapter,
            notifyImgState: (isImgExist: boolean) => {
                this.setState({ isImgExist });
            },
            notifyEnter: (e: React.MouseEvent) => {
                const { hoverMask } = this.props;
                const hoverContent = hoverMask;
                this.setState({ hoverContent }, () => {
                    const { onMouseEnter } = this.props;
                    onMouseEnter && onMouseEnter(e);
                });
            },
            notifyLeave: (e: React.MouseEvent) => {
                this.setState({ hoverContent: '' }, () => {
                    const { onMouseLeave } = this.props;
                    onMouseLeave && onMouseLeave(e);
                });
            },
            setFocusVisible: (focusVisible: boolean): void => {
                this.setState({ focusVisible });
            },
            setScale: (scale: number) => {
                this.setState({ scale });
            },
            getAvatarNode: () => {
                return this.avatarRef?.current;
            }
        };
    }

    componentDidMount() {
        this.foundation = new AvatarFoundation<AvatarProps, AvatarState>(this.adapter);
        this.foundation.init();
    }

    componentDidUpdate(prevProps: AvatarProps) {
        if (this.props.src && this.props.src !== prevProps.src) {
            const image = new Image(0, 0);
            image.src = this.props.src;
            image.onload = () => {
                this.setState({ isImgExist: true });
            };
            image.onerror = () => {
                this.setState({ isImgExist: false });
            };
            image.onabort = () => {
                this.setState({ isImgExist: false });
            };
        }
        if (typeof this.props.children === "string" && this.props.children !== prevProps.children) {
            this.foundation.changeScale();
        }
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    onEnter(e: React.MouseEvent) {
        this.foundation.handleEnter(e);
    }

    onLeave(e: React.MouseEvent) {
        this.foundation.handleLeave(e);
    }

    handleError() {
        this.foundation.handleImgLoadError();
    }

    handleKeyDown(event: any) {
        const { onClick } = this.props;
        switch (event.key) {
            case "Enter":
                onClick(event);
                handlePrevent(event);
                break;
            case 'Escape':
                event.target.blur();
                break;
            default:
                break;
        }
    }

    handleFocusVisible = (event: React.FocusEvent) => {
        this.foundation.handleFocusVisible(event);
    }

    handleBlur = (event: React.FocusEvent) => {
        this.foundation.handleBlur();
    }

    getContent = () => {
        const { children, onClick, imgAttr, src, srcSet, alt } = this.props;
        const { isImgExist } = this.state;
        let content = children;
        const clickable = onClick !== noop;
        const isImg = src && isImgExist;
        const a11yFocusProps = {
            tabIndex: 0,
            onKeyDown: this.handleKeyDown,
            onFocus: this.handleFocusVisible,
            onBlur: this.handleBlur,
        };
        if (isImg) {
            const finalAlt = clickable ? `clickable Avatar: ${alt}` : alt;
            const imgBasicProps = {
                src,
                srcSet,
                onError: this.handleError,
                ...imgAttr,
                className: cls({
                    [`${prefixCls}-no-focus-visible`]: clickable,
                }),
            };
            const imgProps = clickable ? { ...imgBasicProps, ...a11yFocusProps } : imgBasicProps;
            content = (
                <img alt={finalAlt} {...imgProps}/>
            );
        } else if (typeof children === 'string') {
            const tempAlt = alt ?? children;
            const finalAlt = clickable ? `clickable Avatar: ${tempAlt}` : tempAlt;
            const props = {
                role: 'img',
                'aria-label': finalAlt,
                className: cls(`${prefixCls}-label`,
                    {
                        [`${prefixCls}-no-focus-visible`]: clickable,
                    }
                ),
            };
            const finalProps = clickable ? { ...props, ...a11yFocusProps } : props;
            const stringStyle: React.CSSProperties = {
                transform: `scale(${this.state.scale})`,
            };
            content = (
                <span className={`${prefixCls}-content`} style={stringStyle}>
                    <span {...finalProps} x-semi-prop="children">{children}</span>
                </span>
            );
        }
        return content;
    }


    renderBottomSlot = () => {
        if (!this.props.bottomSlot) {
            return null;
        }

        if (this.props.bottomSlot.render) {
            return this.props.bottomSlot.render();
        }

        const renderContent = this.props.bottomSlot.render ?? (() => {
            const style: CSSProperties = {};
            if (this.props.bottomSlot.bgColor) {
                style['backgroundColor'] = this.props.bottomSlot.bgColor;
            }
            if (this.props.bottomSlot.textColor) {
                style['color'] = this.props.bottomSlot.textColor;
            }
            return <span style={style}
                className={cls(`${prefixCls}-bottom_slot-shape_${this.props.bottomSlot.shape}`, `${prefixCls}-bottom_slot-shape_${this.props.bottomSlot.shape}-${this.props.size}`, this.props.bottomSlot.className ?? "")}>
                {this.props.bottomSlot.text}
            </span>;
        });

        return <div className={cls([`${prefixCls}-bottom_slot`])} style={this.props.bottomSlot.style ?? {}}>
            {renderContent()}
        </div>;

    }


    renderTopSlot = () => {

        if (!this.props.topSlot) {
            return null;
        }

        if (this.props.topSlot.render) {
            return this.props.topSlot.render();
        }

        const textStyle: CSSProperties = {};
        if (this.props.topSlot.textColor) {
            textStyle['color'] = this.props.topSlot.textColor;
        }
        return <div style={this.props.topSlot.style ?? {}}
            className={cls([`${prefixCls}-top_slot-wrapper`, this.props.topSlot.className ?? "", {
                [`${prefixCls}-animated`]: this.props.contentMotion,
            }])}>
            <div className={cls([`${prefixCls}-top_slot-bg`, `${prefixCls}-top_slot-bg-${this.props.size}`])}>
                <div
                    className={cls([`${prefixCls}-top_slot-bg-svg`, `${prefixCls}-top_slot-bg-svg-${this.props.size}`])}>
                    <TopSlotSvg gradientStart={this.props.topSlot.gradientStart ?? "var(--semi-color-primary)"}
                        gradientEnd={this.props.topSlot.gradientEnd ?? "var(--semi-color-primary)"}/>
                </div>
            </div>
            <div className={cls([`${prefixCls}-top_slot`])}>
                <div
                    style={textStyle}
                    className={cls([`${prefixCls}-top_slot-content`, `${prefixCls}-top_slot-content-${this.props.size}`])}>{this.props.topSlot.text}</div>
            </div>
        </div>;
    }

    render() {
        const {
            shape,
            children,
            size,
            color,
            className,
            hoverMask,
            onClick,
            imgAttr,
            src,
            srcSet,
            style,
            alt,
            gap,
            bottomSlot,
            topSlot,
            border,
            contentMotion,
            ...others
        } = this.props;
        const { isImgExist, hoverContent, focusVisible } = this.state;
        let customStyle: CSSProperties = {};
        if (!strings.SIZE.includes(size)) {
            customStyle = { width: size, height: size };
        }
        customStyle = { ...customStyle, ...style };
        const shouldWrap = bottomSlot || topSlot || border;
        const mouseEvent = {
            onClick: onClick,
            onMouseEnter: this.onEnter,
            onMouseLeave: this.onLeave,
        };
        const isImg = src && isImgExist;
        const avatarCls = cls(
            prefixCls,
            {
                [`${prefixCls}-${shape}`]: shape,
                [`${prefixCls}-${size}`]: size,
                [`${prefixCls}-${color}`]: color && !isImg,
                [`${prefixCls}-img`]: isImg,
                [`${prefixCls}-focus`]: focusVisible,
                [`${prefixCls}-animated`]: contentMotion,
            },
            className
        );

        const hoverRender = hoverContent ? (
            <div className={`${prefixCls}-hover`} x-semi-prop="hoverContent">{hoverContent}</div>) : null;

        let avatar = <span
            {...(others as any)}
            style={shouldWrap ? {} : customStyle}
            className={avatarCls}
            {...(shouldWrap ? {} : mouseEvent)}
            role='listitem'
            ref={this.avatarRef}>
            {this.getContent()}
            {hoverRender}
        </span>;


        if (border) {
            const borderStyle: CSSProperties = {};
            if (typeof border === 'object' && border?.color) {
                borderStyle['borderColor'] = border?.color;
            }
            avatar = <div style={{ position: "relative", ...customStyle }}>
                {avatar}
                <span style={borderStyle} className={cls([
                    `${prefixCls}-additionalBorder`,
                    `${prefixCls}-additionalBorder-${size}`,
                    {
                        [`${prefixCls}-${shape}`]: shape,
                    },
                ])}>
                </span>
                {
                    (typeof this.props.border === 'object' && this.props.border.motion) &&
                    <span style={borderStyle} className={cls([
                        `${prefixCls}-additionalBorder`,
                        `${prefixCls}-additionalBorder-${size}`,
                        {
                            [`${prefixCls}-${shape}`]: shape,
                            [`${prefixCls}-additionalBorder-animated`]: typeof this.props.border === 'object' && this.props.border?.motion,
                        },
                    ])}/>
                }
            </div>;

        }


        if (shouldWrap) {
            return <span className={cls([`${prefixCls}-wrapper`])} style={customStyle} {...mouseEvent}>
                {avatar}
                {topSlot && ["extra-small", "small", "default", "medium", "large", "extra-large"].includes(size) && shape === "circle" && this.renderTopSlot()}
                {bottomSlot && ["extra-small", "small", "default", "medium", "large", "extra-large"].includes(size) && this.renderBottomSlot()}
            </span>;
        } else {
            return avatar;
        }
    }
}
Avatar.elementType = 'Avatar';
